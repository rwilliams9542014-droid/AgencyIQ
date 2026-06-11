param(
  [string]$QuickFilePath = "Q:\QuickFL",
  [string]$OutputPath = ".\quickfile-agencyiq-export.json",
  [switch]$SkipMemos,
  [switch]$SkipBilling,
  [switch]$SkipDocuments,
  [switch]$SkipForms,
  [switch]$SkipQuotes,
  [int]$MaxClients = 0,
  [int]$MaxPolicies = 0,
  [int]$CommandTimeoutSeconds = 120
)

$ErrorActionPreference = "Stop"

function Open-AccessDb {
  param([string]$Path)
  if (-not (Test-Path -LiteralPath $Path)) {
    throw "QuickFile database not found: $Path"
  }

  $connection = New-Object System.Data.OleDb.OleDbConnection(
    "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$Path;Persist Security Info=False;"
  )
  $connection.Open()
  return $connection
}

function Read-Table {
  param(
    [System.Data.OleDb.OleDbConnection]$Connection,
    [string]$TableName,
    [string]$Where = "",
    [string]$OrderBy = "",
    [int]$Top = 0
  )

  $topClause = if ($Top -gt 0) { "TOP $Top " } else { "" }
  $sql = "SELECT $topClause* FROM [$TableName]"
  if ($Where) { $sql += " WHERE $Where" }
  if ($OrderBy) { $sql += " ORDER BY $OrderBy" }

  $command = $Connection.CreateCommand()
  $command.CommandText = $sql
  $command.CommandTimeout = $CommandTimeoutSeconds
  $adapter = New-Object System.Data.OleDb.OleDbDataAdapter($command)
  $table = New-Object System.Data.DataTable
  try {
    [void]$adapter.Fill($table)
    return ,$table
  } catch {
    Write-Warning "Full table read failed for [$TableName]. Retrying without Access Object/Binary columns. $($_.Exception.Message)"
  }

  $schema = $Connection.GetOleDbSchemaTable([System.Data.OleDb.OleDbSchemaGuid]::Columns, @($null, $null, $TableName, $null))
  $excludedTypes = @(
    13,  # IUnknown / Object
    128, # Binary
    204, # VarBinary
    205  # LongVarBinary / OLE Object
  )
  $safeColumns = @()
  foreach ($row in $schema.Rows) {
    $columnName = [string]$row["COLUMN_NAME"]
    $dataType = [int]$row["DATA_TYPE"]
    if ($excludedTypes -contains $dataType) {
      Write-Warning "Skipping unsupported Access column [$TableName].[$columnName] with OLEDB type $dataType"
      continue
    }
    $safeColumns += "[$($columnName.Replace(']', ']]'))]"
  }

  if ($safeColumns.Count -eq 0) {
    Write-Warning "No safe columns found for [$TableName]. Returning an empty table."
    return ,(New-Object System.Data.DataTable)
  }

  $safeSql = "SELECT $topClause$($safeColumns -join ', ') FROM [$TableName]"
  if ($Where) { $safeSql += " WHERE $Where" }
  if ($OrderBy) { $safeSql += " ORDER BY $OrderBy" }

  $safeCommand = $Connection.CreateCommand()
  $safeCommand.CommandText = $safeSql
  $safeCommand.CommandTimeout = $CommandTimeoutSeconds
  $safeAdapter = New-Object System.Data.OleDb.OleDbDataAdapter($safeCommand)
  $safeTable = New-Object System.Data.DataTable
  [void]$safeAdapter.Fill($safeTable)
  return ,$safeTable
}

function DbValue {
  param($Row, [string]$Name, $Default = $null)
  if ($null -eq $Row -or $null -eq $Row.Table) { return $Default }
  if (-not $Row.Table.Columns.Contains($Name)) { return $Default }
  $value = $Row[$Name]
  if ($null -eq $value -or $value -is [DBNull]) { return $Default }
  return $value
}

function Clean-String {
  param($Value)
  if ($null -eq $Value -or $Value -is [DBNull]) { return "" }
  return ([string]$Value).Trim()
}

function Sql-Literal {
  param($Value)
  if ($null -eq $Value -or $Value -is [DBNull]) { return "NULL" }
  if ($Value -is [int] -or $Value -is [long] -or $Value -is [decimal] -or $Value -is [double]) { return "$Value" }
  $text = ([string]$Value).Replace("'", "''")
  return "'$text'"
}

function Sql-In-Where {
  param([string]$ColumnName, $Values)
  $literals = @($Values | Where-Object { $null -ne $_ -and -not ($_ -is [DBNull]) } | Select-Object -Unique | ForEach-Object { Sql-Literal $_ })
  if ($literals.Count -eq 0) { return "" }
  return "[$ColumnName] IN ($($literals -join ', '))"
}

function Iso-Date {
  param($Value)
  if ($null -eq $Value -or $Value -is [DBNull]) { return $null }
  try {
    return ([datetime]$Value).ToString("yyyy-MM-dd")
  } catch {
    return $null
  }
}

function Iso-DateTime {
  param($DateValue, $TimeValue = $null)
  $date = Iso-Date $DateValue
  if (-not $date) { return (Get-Date).ToUniversalTime().ToString("o") }

  try {
    if ($null -ne $TimeValue -and -not ($TimeValue -is [DBNull])) {
      $time = ([datetime]$TimeValue).ToString("HH:mm:ss")
      return ([datetime]"$date $time").ToUniversalTime().ToString("o")
    }
  } catch {}

  return ([datetime]"$date 12:00:00").ToUniversalTime().ToString("o")
}

function Money {
  param($Value)
  if ($null -eq $Value -or $Value -is [DBNull]) { return 0 }
  try { return [math]::Round([double]$Value, 2) } catch { return 0 }
}

function Commission-Rate {
  param($Value)
  $rate = Money $Value
  if ($rate -gt 0 -and $rate -le 1) {
    return [math]::Round($rate * 100, 4)
  }
  return $rate
}

function First-NonEmpty-DbValue {
  param($Row, [string[]]$Columns)
  foreach ($column in $Columns) {
    $value = Clean-String (DbValue $Row $column)
    if ($value) { return $value }
  }
  return ""
}

function Normalize-QuickFile-ClientName {
  param($Company, $First, $Middle, $Last, $QuickClientId)

  $cleanCompany = Clean-String $Company
  $cleanFirst = Clean-String $First
  $cleanMiddle = Clean-String $Middle
  $cleanLast = Clean-String $Last

  if (-not $cleanCompany) {
    if ($cleanLast -match "^\s*([^,]+),\s*(.+)\s*$" -and -not $cleanFirst) {
      $cleanLast = $matches[1].Trim()
      $cleanFirst = $matches[2].Trim()
    } elseif ($cleanFirst -match "^\s*([^,]+),\s*(.+)\s*$" -and -not $cleanLast) {
      $cleanLast = $matches[1].Trim()
      $cleanFirst = $matches[2].Trim()
    }
  }

  $personalName = (@($cleanFirst, $cleanMiddle, $cleanLast) | Where-Object { $_ }) -join " "
  $displayName = if ($cleanCompany) { $cleanCompany } elseif ($personalName) { $personalName } else { "QuickFile Client $QuickClientId" }
  $primaryContact = if ($cleanCompany -and $personalName) { $personalName } else { $displayName }

  return [ordered]@{
    Company = $cleanCompany
    First = $cleanFirst
    Middle = $cleanMiddle
    Last = $cleanLast
    Display = $displayName
    PrimaryContact = $primaryContact
  }
}

function Boolish {
  param($Value)
  if ($null -eq $Value -or $Value -is [DBNull]) { return $false }
  if ($Value -is [bool]) { return $Value }
  if ($Value -is [int] -or $Value -is [double]) { return [double]$Value -ne 0 }
  $text = ([string]$Value).Trim().ToLowerInvariant()
  return @("y", "yes", "true", "1", "-1", "x") -contains $text
}

function Join-Address {
  param($Line1, $Line2, $City, $State, $Zip)
  $parts = @(
    (Clean-String $Line1),
    (Clean-String $Line2),
    ((@((Clean-String $City), (Clean-String $State), (Clean-String $Zip)) | Where-Object { $_ }) -join " ")
  ) | Where-Object { $_ }
  return ($parts -join ", ")
}

function Safe-Id {
  param([string]$Prefix, $Value)
  $raw = if ($null -eq $Value -or $Value -is [DBNull] -or "$Value" -eq "") { [guid]::NewGuid().ToString() } else { "$Value" }
  $clean = $raw.ToLowerInvariant() -replace "[^a-z0-9-]", "-"
  return "$Prefix-$clean"
}

function User-Id-From-Name {
  param([string]$Name)
  $clean = (Clean-String $Name).ToLowerInvariant() -replace "[^a-z0-9]+", "-"
  if (-not $clean) { return "user-quickfile-import" }
  return "user-qf-$clean"
}

function Make-Initials {
  param([string]$Name)
  $parts = (Clean-String $Name).Split(" ", [System.StringSplitOptions]::RemoveEmptyEntries)
  if ($parts.Count -eq 0) { return "QF" }
  return (($parts | Select-Object -First 2 | ForEach-Object { $_.Substring(0, 1).ToUpperInvariant() }) -join "")
}

function Line-Of-Business {
  param($ClientRow, $PolicyRow = $null)
  $commercial = Boolish (DbValue $ClientRow "isCOMMERCIAL")
  if ($PolicyRow) {
    $lob = (Clean-String (DbValue $PolicyRow "LOB")).ToLowerInvariant()
    $coverage = (Clean-String (DbValue $PolicyRow "Coverage")).ToLowerInvariant()
    if ($lob -match "life|health" -or $coverage -match "life|health") { return "Life & health" }
    if ($lob -match "comm|gl|business|workers|property|liability|garage|bop" -or $coverage -match "comm|gl|business|workers|property|liability|garage|bop") { return "Commercial" }
  }
  if ($commercial) { return "Commercial" }
  return "Personal lines"
}

function Policy-Status {
  param($Row)
  $pstatus = (Clean-String (DbValue $Row "PSTATUS")).ToUpperInvariant()
  $cancelDate = Iso-Date (DbValue $Row "CANCEL_DAT")
  $expiration = Iso-Date (DbValue $Row "EXPIRATION")
  if ($cancelDate) { return "Cancelled" }
  if ($pstatus -eq "Q") { return "Quoted" }
  if ($pstatus -eq "B") { return "Bound" }
  if ($expiration -and ([datetime]$expiration) -lt (Get-Date).Date) { return "Expired" }
  return "Active"
}

function Billing-Type {
  param($Row)
  $dirBill = (Clean-String (DbValue $Row "DIR_BILL")).ToUpperInvariant()
  $billingType = (Clean-String (DbValue $Row "BillingType")).ToUpperInvariant()
  if ($dirBill -eq "Y" -or $billingType -eq "D") { return "Direct Bill" }
  if ((Clean-String (DbValue $Row "FinCompany"))) { return "Financed" }
  return "Agency Bill"
}

function Legacy-Object {
  param($Row, [string[]]$Columns)
  $object = [ordered]@{}
  foreach ($column in $Columns) {
    $value = DbValue $Row $column
    if ($null -ne $value -and -not ($value -is [DBNull]) -and "$value" -ne "") {
      $object[$column] = $value
    }
  }
  return $object
}

$mainDb = Join-Path $QuickFilePath "QFWinData.Mdb"
$formsDb = Join-Path $QuickFilePath "QFWinXmlFormData.MDB"
$quotesDb = Join-Path $QuickFilePath "Quotes.MDB"
$certDb = Join-Path $QuickFilePath "QFWinCertHolders.MDB"

$accountId = "agency-quickfile-import"
$importUserId = "user-quickfile-import"

$main = Open-AccessDb $mainDb

try {
  Write-Host "Reading QuickFile clients..."
  $clientRows = Read-Table $main "CLNMAS" -Top $MaxClients
  $selectedQuickClientIds = @($clientRows.Rows | ForEach-Object { DbValue $_ "CLIENT_ID" } | Where-Object { $null -ne $_ -and -not ($_ -is [DBNull]) })
  $policyWhere = if ($MaxClients -gt 0) { Sql-In-Where "CLIENT_ID" $selectedQuickClientIds } else { "" }
  Write-Host "Reading QuickFile policies..."
  $policyRows = Read-Table $main "POLMAS" -Where $policyWhere -Top $MaxPolicies
  Write-Host "Reading QuickFile carriers and coverage lists..."
  $companyRows = Read-Table $main "Company"
  $rolodexRows = Read-Table $main "ROLODEX"
  $coverageRows = Read-Table $main "Coverage"

  $policyCountByClient = @{}
  $activePremiumByClient = @{}
  $clientRowByQuickId = @{}
  foreach ($row in $clientRows.Rows) {
    $quickClientId = DbValue $row "CLIENT_ID"
    if ($null -ne $quickClientId -and -not ($quickClientId -is [DBNull])) {
      $clientRowByQuickId["$quickClientId"] = $row
    }
  }

  foreach ($row in $policyRows.Rows) {
    $clientId = DbValue $row "CLIENT_ID"
    if ($null -eq $clientId -or $clientId -is [DBNull]) { continue }
    $key = "$clientId"
    if (-not $policyCountByClient.ContainsKey($key)) { $policyCountByClient[$key] = 0 }
    $policyCountByClient[$key]++
    if (@("Active", "Bound", "Renewal review") -contains (Policy-Status $row)) {
      if (-not $activePremiumByClient.ContainsKey($key)) { $activePremiumByClient[$key] = 0 }
      $activePremiumByClient[$key] += Money (DbValue $row "PISSUED")
    }
  }

  $people = [ordered]@{}
  $people[$importUserId] = @{
    id = $importUserId
    accountId = $accountId
    name = "QuickFile Import"
    initials = "QF"
    role = "Admin"
  }

  foreach ($row in $clientRows.Rows) {
    foreach ($field in @("Agent", "CSR_Clnmas")) {
      $name = Clean-String (DbValue $row $field)
      if ($name) {
        $id = User-Id-From-Name $name
        if (-not $people.Contains($id)) {
          $people[$id] = @{
            id = $id
            accountId = $accountId
            name = $name
            initials = Make-Initials $name
            role = if ($field -eq "CSR_Clnmas") { "CSR" } else { "Producer" }
          }
        }
      }
    }
  }

  $clients = New-Object System.Collections.Generic.List[object]
  $clientMap = @{}
  $clientLoopCount = 0
  foreach ($row in $clientRows.Rows) {
    if ($MaxClients -gt 0 -and $clientLoopCount -ge $MaxClients) { break }
    $clientLoopCount++
    $quickClientId = DbValue $row "CLIENT_ID"
    if ($null -eq $quickClientId -or $quickClientId -is [DBNull]) { continue }
    $clientId = Safe-Id "qf-client" $quickClientId
    $clientMap["$quickClientId"] = $clientId

    $nameParts = Normalize-QuickFile-ClientName `
      (DbValue $row "CompanyName") `
      (DbValue $row "FNAME") `
      (DbValue $row "MiddleName") `
      (DbValue $row "LNAME") `
      $quickClientId
    $company = $nameParts.Company
    $first = $nameParts.First
    $middle = $nameParts.Middle
    $last = $nameParts.Last
    $displayName = $nameParts.Display

    $primaryPhone = First-NonEmpty-DbValue $row @("Cell", "HPhone", "WPHONE", "Phone2")
    $alternatePhone = First-NonEmpty-DbValue $row @("Phone2", "WPHONE", "HPhone", "Cell")
    if ($alternatePhone -eq $primaryPhone) { $alternatePhone = "" }

    $producerName = Clean-String (DbValue $row "Agent")
    $csrName = Clean-String (DbValue $row "CSR_Clnmas")
    $policyCount = if ($policyCountByClient.ContainsKey("$quickClientId")) { $policyCountByClient["$quickClientId"] } else { 0 }
    $annualRevenue = if ($activePremiumByClient.ContainsKey("$quickClientId")) { [math]::Round($activePremiumByClient["$quickClientId"], 2) } else { 0 }

    $client = [ordered]@{
      id = $clientId
      accountId = $accountId
      ownerUserId = if ($producerName) { User-Id-From-Name $producerName } else { $importUserId }
      assignedProducerId = if ($producerName) { User-Id-From-Name $producerName } else { $null }
      assignedCsrId = if ($csrName) { User-Id-From-Name $csrName } else { $null }
      clientType = if (Boolish (DbValue $row "isCOMMERCIAL")) { "Business" } else { "Personal" }
      firstName = $first
      middleName = $middle
      lastName = $last
      dbaName = Clean-String (DbValue $row "DBA")
      taxId = Clean-String (DbValue $row "FEIN")
      name = $displayName
      primaryContact = if ((Clean-String (DbValue $row "Attention"))) { Clean-String (DbValue $row "Attention") } else { $nameParts.PrimaryContact }
      status = if ((Clean-String (DbValue $row "CSTATUS")).ToUpperInvariant() -eq "P") { "Prospect" } else { "Client" }
      accountStatus = if ((Clean-String (DbValue $row "CSTATUS")).ToUpperInvariant() -eq "I") { "Inactive" } elseif ((Clean-String (DbValue $row "CSTATUS")).ToUpperInvariant() -eq "P") { "Prospect" } else { "Active" }
      lineOfBusiness = Line-Of-Business $row
      email = Clean-String (DbValue $row "Email")
      alternatePhone = $alternatePhone
      phone = $primaryPhone
      mailingAddress = Join-Address (DbValue $row "ADDRESS1") (DbValue $row "Address2") (DbValue $row "CITY") (DbValue $row "State") (DbValue $row "ZIP")
      physicalAddress = Join-Address (DbValue $row "X_ADDRESS1") (DbValue $row "X_ADDRESS2") (DbValue $row "X_CITY") (DbValue $row "X_STATE") (DbValue $row "X_ZIP")
      city = Clean-String (DbValue $row "CITY")
      state = Clean-String (DbValue $row "State")
      zip = Clean-String (DbValue $row "ZIP")
      dob = Iso-Date (DbValue $row "DOB")
      notes = (@(
        if (Clean-String (DbValue $row "TypeOfBusiness")) { "Type of business: $(Clean-String (DbValue $row "TypeOfBusiness"))" }
        if (Clean-String (DbValue $row "Source")) { "Source: $(Clean-String (DbValue $row "Source"))" }
        if (Clean-String (DbValue $row "Referer")) { "Referrer: $(Clean-String (DbValue $row "Referer"))" }
        "QuickFile client id: $quickClientId"
      ) | Where-Object { $_ }) -join "`n"
      clientSince = Iso-Date (DbValue $row "DateSold")
      lastContactedAt = if (DbValue $row "LASTUPDATE") { Iso-DateTime (DbValue $row "LASTUPDATE") } else { $null }
      policyCount = $policyCount
      annualRevenue = $annualRevenue
      health = "Strong"
      legacyQuickFile = Legacy-Object $row @("CLIENT_ID", "UNIQUE", "CID", "CSTATUS", "Source", "Source2", "Agency", "Agent", "CSR_Clnmas", "LANGUAGE", "TypeOfBusiness", "ClientType", "DateSold", "TimeAdded", "LASTUPDATE")
    }
    $clients.Add($client)
  }

  $policies = New-Object System.Collections.Generic.List[object]
  $commissionStatements = New-Object System.Collections.Generic.List[object]
  $policyLoopCount = 0
  foreach ($row in $policyRows.Rows) {
    if ($MaxPolicies -gt 0 -and $policyLoopCount -ge $MaxPolicies) { break }
    $policyLoopCount++
    $quickClientId = DbValue $row "CLIENT_ID"
    $quickPolicyId = DbValue $row "POLICY_ID"
    if (-not $clientMap.ContainsKey("$quickClientId")) { continue }

    $policyId = Safe-Id "qf-policy" $quickPolicyId
    $effective = Iso-Date (DbValue $row "EFFECTIVE")
    $expiration = Iso-Date (DbValue $row "EXPIRATION")
    if (-not $expiration) { $expiration = "2099-12-31" }

    $policy = [ordered]@{
      id = $policyId
      accountId = $accountId
      clientId = $clientMap["$quickClientId"]
      carrier = Clean-String (DbValue $row "COMPANY")
      policyType = if (Clean-String (DbValue $row "Coverage")) { Clean-String (DbValue $row "Coverage") } elseif (Clean-String (DbValue $row "LOB")) { Clean-String (DbValue $row "LOB") } else { "QuickFile Policy" }
      lineOfBusiness = Line-Of-Business $clientRowByQuickId["$quickClientId"] $row
      policyNumber = Clean-String (DbValue $row "Policy_Num")
      effectiveDate = $effective
      expirationDate = $expiration
      premium = Money (DbValue $row "PISSUED")
      commissionRate = Commission-Rate (DbValue $row "CRATE")
      billingType = Billing-Type $row
      paymentPlan = Clean-String (DbValue $row "Plan")
      paymentStatus = $null
      renewalStatus = "Not started"
      limits = Clean-String (DbValue $row "DescOfRisk")
      mortgageeOrLienholder = Clean-String (DbValue $row "BILL_MGEE")
      downPayment = Money (DbValue $row "DN_PAYMENT")
      monthlyPayment = Money (DbValue $row "MPAY_AMT")
      financeCompany = Clean-String (DbValue $row "FinCompany")
      producerUserId = if (Clean-String (DbValue $row "Agent_Polmas")) { User-Id-From-Name (Clean-String (DbValue $row "Agent_Polmas")) } else { $null }
      csrUserId = if (Clean-String (DbValue $row "CSR")) { User-Id-From-Name (Clean-String (DbValue $row "CSR")) } else { $null }
      notes = (@(
        if (Clean-String (DbValue $row "CovDesc")) { "Coverage description: $(Clean-String (DbValue $row "CovDesc"))" }
        if (Clean-String (DbValue $row "TypeOfBus")) { "Type of business: $(Clean-String (DbValue $row "TypeOfBus"))" }
        if (Clean-String (DbValue $row "CONTRACTNO")) { "Contract no: $(Clean-String (DbValue $row "CONTRACTNO"))" }
        "QuickFile policy id: $quickPolicyId"
      ) | Where-Object { $_ }) -join "`n"
      status = Policy-Status $row
      billing = @{
        paymentPlanType = $null
        billingResponsibility = if ((Billing-Type $row) -eq "Direct Bill") { "Insured pays carrier direct" } elseif ((Billing-Type $row) -eq "Financed") { "Finance company pays carrier" } else { "Agency collects & remits" }
        installmentAmount = Money (DbValue $row "MPAY_AMT")
        installmentCount = DbValue $row "MPAY_NUM"
        downPaymentAmount = Money (DbValue $row "DN_PAYMENT")
        financeCompany = Clean-String (DbValue $row "FinCompany")
        financeContractNumber = Clean-String (DbValue $row "CONTRACTNO")
        financeAmount = Money (DbValue $row "AMT_FIN")
        agencyBillInvoiceNumber = Clean-String (DbValue $row "RECEIPT_NO")
        billingNotes = Clean-String (DbValue $row "Opt_Info")
      }
      legacyQuickFile = Legacy-Object $row @("CLIENT_ID", "POLICY_ID", "UNIQUE", "PPOS", "PSTATUS", "CSTATUS", "BINDER_NUM", "QQC", "LOB", "Coverage", "COMPANY", "NAIC", "Broker", "Wholesaler", "BillingType", "DIR_BILL", "CANCEL_DAT", "DateEntered", "TimeEntered", "LASTUPDATE")
    }
    $policies.Add($policy)

    if ($policy.premium -gt 0 -and $policy.commissionRate -gt 0) {
      $commissionStatements.Add([ordered]@{
        id = Safe-Id "qf-commission" $quickPolicyId
        accountId = $accountId
        clientId = $clientMap["$quickClientId"]
        policyId = $policyId
        carrier = $policy.carrier
        statementDate = if ($effective) { $effective } else { (Get-Date).ToString("yyyy-MM-dd") }
        premium = $policy.premium
        commissionRate = $policy.commissionRate
        commissionAmount = [math]::Round(($policy.premium * $policy.commissionRate) / 100, 2)
        producerUserId = $policy.producerUserId
        status = "Expected"
        notes = "Imported from QuickFile commission rate."
      })
    }
  }

  $notes = New-Object System.Collections.Generic.List[object]
  if (-not $SkipMemos) {
    Write-Host "Reading QuickFile memos..."
    $memoRows = Read-Table $main "MEMOMAS" -Where $policyWhere
    foreach ($row in $memoRows.Rows) {
      $quickClientId = DbValue $row "CLIENT_ID"
      if (-not $clientMap.ContainsKey("$quickClientId")) { continue }
      $memoId = DbValue $row "MEMO_ID"
      $body = Clean-String (DbValue $row "MEMOLINE")
      if (-not $body) { continue }
      $notes.Add([ordered]@{
        id = Safe-Id "qf-note" $memoId
        accountId = $accountId
        clientId = $clientMap["$quickClientId"]
        createdByUserId = if (Clean-String (DbValue $row "CSR")) { User-Id-From-Name (Clean-String (DbValue $row "CSR")) } else { $importUserId }
        createdAt = Iso-DateTime (DbValue $row "MEMODATE") (DbValue $row "TIME")
        type = "General"
        pinned = $false
        body = $body
        legacyQuickFile = Legacy-Object $row @("MEMO_ID", "CLIENT_ID", "POLICY_ID", "MPOS", "MEMODATE", "REMDATE", "MemoType", "FLAG", "CSR")
      })
    }
  }

  if (-not $SkipBilling) {
    Write-Host "Reading QuickFile billing/payment ledger..."
    $billRows = Read-Table $main "BILLMAS" -Where $policyWhere
    foreach ($row in $billRows.Rows) {
      $quickClientId = DbValue $row "CLIENT_ID"
      if (-not $clientMap.ContainsKey("$quickClientId")) { continue }
      $billId = DbValue $row "BILL_ID"
      $charge = Money (DbValue $row "BCHARGES")
      $payment = Money (DbValue $row "BPAYMENTS")
      $description = Clean-String (DbValue $row "DetailedDesc")
      if (-not $description) { $description = Clean-String (DbValue $row "BDesc") }
      $notes.Add([ordered]@{
        id = Safe-Id "qf-billing" $billId
        accountId = $accountId
        clientId = $clientMap["$quickClientId"]
        createdByUserId = if (Clean-String (DbValue $row "CSR")) { User-Id-From-Name (Clean-String (DbValue $row "CSR")) } else { $importUserId }
        createdAt = Iso-DateTime (DbValue $row "BDATE") (DbValue $row "TIME")
        type = "Payment"
        pinned = $false
        body = "QuickFile billing: $description`nCharges: $charge`nPayments: $payment`nReceipt: $(Clean-String (DbValue $row "ReceiptNum"))`nDue: $(Iso-Date (DbValue $row "DueDate"))"
        legacyQuickFile = Legacy-Object $row @("BILL_ID", "CLIENT_ID", "POLICY_ID", "PID", "BDATE", "BDesc", "BCHARGES", "BPAYMENTS", "CASH_CHECK", "Check_Num", "ReceiptNum", "DueDate", "DetailedDesc")
      })
    }
  }

  if (-not $SkipDocuments) {
    Write-Host "Reading QuickFile image/document references and letters..."
    $imageWhere = if ($MaxClients -gt 0) { Sql-In-Where "Client_ID" $selectedQuickClientIds } else { "" }
    $imageRows = Read-Table $main "Images" -Where $imageWhere
    foreach ($row in $imageRows.Rows) {
      $quickClientId = DbValue $row "Client_ID"
      if (-not $clientMap.ContainsKey("$quickClientId")) { continue }
      $imageId = DbValue $row "Images_ID"
      $fileName = Clean-String (DbValue $row "FileName")
      $description = Clean-String (DbValue $row "Description")
      $notes.Add([ordered]@{
        id = Safe-Id "qf-document" $imageId
        accountId = $accountId
        clientId = $clientMap["$quickClientId"]
        createdByUserId = if (Clean-String (DbValue $row "CSR_Images")) { User-Id-From-Name (Clean-String (DbValue $row "CSR_Images")) } else { $importUserId }
        createdAt = Iso-DateTime (DbValue $row "DateEntered") (DbValue $row "TimeEntered")
        type = "Underwriting"
        pinned = $false
        body = "QuickFile document reference: $description`nFile: $fileName`nOriginal folder: $QuickFilePath\Images"
        legacyQuickFile = Legacy-Object $row @("Images_ID", "Client_ID", "Policy_ID", "FileName", "Description", "DateEntered", "CSR_Images")
      })
    }

    $letterRows = Read-Table $main "Letters" -Where $imageWhere
    foreach ($row in $letterRows.Rows) {
      $quickClientId = DbValue $row "Client_ID"
      if (-not $clientMap.ContainsKey("$quickClientId")) { continue }
      $letterId = DbValue $row "Letter_ID"
      $notes.Add([ordered]@{
        id = Safe-Id "qf-letter" $letterId
        accountId = $accountId
        clientId = $clientMap["$quickClientId"]
        createdByUserId = if (Clean-String (DbValue $row "CSR_Letters")) { User-Id-From-Name (Clean-String (DbValue $row "CSR_Letters")) } else { $importUserId }
        createdAt = Iso-DateTime (DbValue $row "DateSent") (DbValue $row "TimeSent")
        type = "General"
        pinned = $false
        body = "QuickFile letter: $(Clean-String (DbValue $row "LetterName"))`nDescription: $(Clean-String (DbValue $row "Descriptions"))"
        legacyQuickFile = Legacy-Object $row @("Letter_ID", "Client_ID", "Policy_ID", "Descriptions", "DateSent", "LetterName", "Printed", "PrintAgain", "CSR_Letters")
      })
    }
  }

  $carrierResources = New-Object System.Collections.Generic.List[object]
  foreach ($row in $companyRows.Rows) {
    $name = Clean-String (DbValue $row "Company")
    if (-not $name) { continue }
    $carrierResources.Add([ordered]@{
      id = Safe-Id "qf-company" (DbValue $row "Random")
      accountId = $accountId
      name = $name
      category = "Carrier portal"
      lines = @("Other")
      url = ""
      note = "QuickFile carrier. LOB: $(Clean-String (DbValue $row "LOB")); Coverage: $(Clean-String (DbValue $row "Coverage")); NAIC: $(Clean-String (DbValue $row "NAIC")); FEIN: $(Clean-String (DbValue $row "FEIN"))"
      legacyQuickFile = Legacy-Object $row @("Random", "Company", "LOB", "QQC", "NAIC", "FEIN", "Coverage")
    })
  }
  foreach ($row in $rolodexRows.Rows) {
    $name = Clean-String (DbValue $row "Company")
    if (-not $name) { continue }
    $carrierResources.Add([ordered]@{
      id = Safe-Id "qf-rolodex" (DbValue $row "Random")
      accountId = $accountId
      name = $name
      category = "Carrier portal"
      lines = @("Other")
      url = ""
      note = "QuickFile rolodex: $(Clean-String (DbValue $row "CONTACT")); Phone: $(Clean-String (DbValue $row "PHONE800")); Local: $(Clean-String (DbValue $row "LOCALPHONE")); Fax: $(Clean-String (DbValue $row "FAXPHONE")); Address: $(Join-Address (DbValue $row "Address") (DbValue $row "ADDRESS2") (DbValue $row "City") (DbValue $row "State") (DbValue $row "ZIP"))"
      legacyQuickFile = Legacy-Object $row @("Random", "Company", "ABBR", "CONTACT", "PHONE800", "LOCALPHONE", "FAXPHONE", "BINDER_PH", "ADDL_PHONE", "NOTE1", "NOTE2", "NOTE3", "M_G_A_")
    })
  }

  $quoteRequests = New-Object System.Collections.Generic.List[object]
  if (-not $SkipQuotes -and (Test-Path -LiteralPath $quotesDb)) {
    Write-Host "Reading QuickFile quotes..."
    $quotes = Open-AccessDb $quotesDb
    try {
      $quoteRows = Read-Table $quotes "Quotes"
      foreach ($row in $quoteRows.Rows) {
        $quoteId = DbValue $row "Random"
        if ($null -eq $quoteId -or $quoteId -is [DBNull]) { $quoteId = [guid]::NewGuid().ToString() }
        $quoteRequests.Add([ordered]@{
          id = Safe-Id "qf-quote" $quoteId
          accountId = $accountId
          clientId = ""
          createdByUserId = $importUserId
          line = "Other"
          status = "Started"
          createdAt = (Get-Date).ToUniversalTime().ToString("o")
          legacyQuickFile = Legacy-Object $row ($row.Table.Columns | ForEach-Object { $_.ColumnName })
        })
      }
    } finally {
      $quotes.Close()
    }
  }

  $acordDrafts = New-Object System.Collections.Generic.List[object]
  if (-not $SkipForms -and (Test-Path -LiteralPath $formsDb)) {
    Write-Host "Reading QuickFile ACORD/XML forms metadata..."
    $forms = Open-AccessDb $formsDb
    try {
      $formRows = Read-Table $forms "XMLTable"
      foreach ($row in $formRows.Rows) {
        $quickClientId = DbValue $row "Client_ID"
        if (-not $clientMap.ContainsKey("$quickClientId")) { continue }
        $acordId = DbValue $row "Acord_ID"
        $formName = Clean-String (DbValue $row "Form1Name")
        $desc = Clean-String (DbValue $row "Description")
        $answers = [ordered]@{
          quickFileFormName = $formName
          quickFileDescription = $desc
          quickFileFormVersion = Clean-String (DbValue $row "FormVersion")
          quickFileXmlPage1 = Clean-String (DbValue $row "XMLDataPage1")
          quickFileXmlPage2 = Clean-String (DbValue $row "XMLDataPage2")
          quickFileXmlPage3 = Clean-String (DbValue $row "XMLDataPage3")
          quickFileXmlPage4 = Clean-String (DbValue $row "XMLDataPage4")
          quickFileXmlPage5 = Clean-String (DbValue $row "XMLDataPage5")
        }
        $acordDrafts.Add([ordered]@{
          id = Safe-Id "qf-acord" $acordId
          accountId = $accountId
          clientId = $clientMap["$quickClientId"]
          formType = $formName
          formTitle = if ($desc) { "$formName - $desc" } else { $formName }
          answers = $answers
          status = if (Boolish (DbValue $row "WasPrinted")) { "completed" } else { "draft" }
          generatedFileName = $null
          generatedAt = if (DbValue $row "DatePrinted") { Iso-DateTime (DbValue $row "DatePrinted") (DbValue $row "TimePrinted") } else { $null }
          createdByUserId = if (Clean-String (DbValue $row "CSR_XmlTable")) { User-Id-From-Name (Clean-String (DbValue $row "CSR_XmlTable")) } else { $importUserId }
          createdAt = Iso-DateTime (DbValue $row "DateAdded") (DbValue $row "TimeEntered")
          updatedAt = Iso-DateTime (DbValue $row "DateUpdated") (DbValue $row "TimeEntered")
          legacyQuickFile = Legacy-Object $row @("Acord_ID", "Client_ID", "Policy_ID", "FormType", "Form1Name", "Detail_Form1Name", "FormID", "FormVersion", "DateAdded", "DateUpdated", "Description", "IsActive", "ToBePrinted", "WasPrinted", "IsAcord", "IsDetail", "CSR_XmlTable")
        })
      }
    } finally {
      $forms.Close()
    }
  }

  $dataset = [ordered]@{
    exportedAt = (Get-Date).ToUniversalTime().ToString("o")
    format = "agencyiq-portable-json-v1"
    sourceSystem = "QuickFile Florida"
    sourcePath = $QuickFilePath
    agency = @{
      id = $accountId
      name = "QuickFile Imported Agency"
      plan = "Demo"
    }
    currentUser = $people[$importUserId]
    users = @($people.GetEnumerator() | ForEach-Object { $_.Value })
    clients = @($clients.ToArray())
    policies = @($policies.ToArray())
    commissionStatements = @($commissionStatements.ToArray())
    renewals = @()
    tasks = @()
    opportunities = @()
    quoteRequests = @($quoteRequests.ToArray())
    carrierResources = @($carrierResources.ToArray())
    notes = @($notes.ToArray())
    acordDrafts = @($acordDrafts.ToArray())
    quickFileSummary = @{
      clients = $clients.Count
      policies = $policies.Count
      notesAndHistory = $notes.Count
      carriersAndRolodex = $carrierResources.Count
      quotes = $quoteRequests.Count
      savedForms = $acordDrafts.Count
      skippedMemos = [bool]$SkipMemos
      skippedBilling = [bool]$SkipBilling
      skippedDocuments = [bool]$SkipDocuments
      skippedForms = [bool]$SkipForms
      skippedQuotes = [bool]$SkipQuotes
    }
  }

  $resolvedOutput = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
  $json = $dataset | ConvertTo-Json -Depth 30
  [System.IO.File]::WriteAllText($resolvedOutput, $json, [System.Text.UTF8Encoding]::new($false))
  Write-Host "QuickFile export created: $resolvedOutput"
  Write-Host ($dataset.quickFileSummary | ConvertTo-Json)
} finally {
  $main.Close()
}
