import type { Client, Policy, Renewal, Task, ClientNote } from './crmTypes'

const ACCOUNT_ID = 'agency-demo-allied'

const USERS = {
  ronny: 'user-ronny',
  mia: 'user-mia',
  james: 'user-james',
  evan: 'user-evan',
  avery: 'user-avery',
}

const ALL_USER_IDS = Object.values(USERS)

const CARRIERS = [
  'Travelers',
  'Progressive',
  'CNA',
  'Chubb',
  'Safeco',
  'The Hartford',
  'Nationwide',
  'Liberty Mutual',
  'Zurich',
  'AmTrust',
  'State Auto',
  'Westfield',
  'Employers',
  'ICW Group',
  'Berkley One',
]

const POLICY_TYPES_PERSONAL = [
  'Personal auto',
  'Homeowners (HO-3)',
  'DP-1 (dwelling)',
  'Umbrella',
]

const POLICY_TYPES_COMMERCIAL = [
  'General liability',
  'Workers compensation',
  'Business owners policy (BOP)',
  'Commercial property',
  'Commercial auto',
  'Professional liability',
  'Inland marine',
  'Liquor liability',
]

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number, digits = 3): string {
  return String(n).padStart(digits, '0')
}

function dateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function addDays(date: string, days: number): string {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

// ─── Master client list (100 entries, statically defined) ────────────────────

const RAW_CLIENTS: Array<{
  isCommercial: boolean
  name: string
  primaryContact: string
  city: string
  health: 'Strong' | 'Needs review' | 'At risk'
  accountStatus: 'Active' | 'Inactive' | 'Prospect'
  producerId: string
  csrId: string
  clientSince: string
  lastContactedAt: string
  policyCount: number
  annualRevenue: number
  email: string
  phone: string
  address: string
}> = [
  // 1-10 Commercial
  { isCommercial: true, name: 'Carolina Roofing LLC', primaryContact: 'Thomas Mitchell', city: 'Charlotte', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2019-03-15', lastContactedAt: '2026-02-14T10:00:00.000Z', policyCount: 3, annualRevenue: 87000, email: 'carolinaroofing@gmail.com', phone: '(704) 555-0101', address: '4210 Commerce Dr, Charlotte, NC 28201' },
  { isCommercial: true, name: 'Piedmont Electrical Inc.', primaryContact: 'Sandra Harris', city: 'Greensboro', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2018-07-22', lastContactedAt: '2026-01-30T09:00:00.000Z', policyCount: 2, annualRevenue: 64000, email: 'piedmontelectric@outlook.com', phone: '(336) 555-0202', address: '887 Industrial Blvd, Greensboro, NC 27401' },
  { isCommercial: true, name: 'Blue Ridge Construction Corp.', primaryContact: 'Kevin Anderson', city: 'Asheville', health: 'Needs review', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2020-11-05', lastContactedAt: '2026-03-08T09:00:00.000Z', policyCount: 3, annualRevenue: 105000, email: 'blueridgeconstruction@company.com', phone: '(828) 555-0303', address: '2145 Ridge Rd, Asheville, NC 28801' },
  { isCommercial: true, name: 'Tarheel Trucking Co.', primaryContact: 'Lisa Thompson', city: 'Fayetteville', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2017-05-18', lastContactedAt: '2026-04-11T10:00:00.000Z', policyCount: 2, annualRevenue: 72000, email: 'tarheeltrucking@gmail.com', phone: '(910) 555-0404', address: '3300 Business Park Way, Fayetteville, NC 28301' },
  { isCommercial: true, name: 'Coastal HVAC Solutions LLC', primaryContact: 'Robert Garcia', city: 'Wilmington', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2021-02-28', lastContactedAt: '2026-02-22T09:00:00.000Z', policyCount: 2, annualRevenue: 58000, email: 'coastalhvac@biz.net', phone: '(910) 555-0505', address: '1560 Gateway Blvd, Wilmington, NC 28401' },
  { isCommercial: true, name: 'Triangle Technology Corp.', primaryContact: 'Jennifer Wilson', city: 'Raleigh', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2020-09-14', lastContactedAt: '2026-04-03T09:00:00.000Z', policyCount: 2, annualRevenue: 93000, email: 'triangletech@corp.net', phone: '(919) 555-0606', address: '500 Technology Dr, Raleigh, NC 27601' },
  { isCommercial: true, name: 'Yadkin Valley Landscaping LLC', primaryContact: 'Daniel Brown', city: 'Winston-Salem', health: 'Needs review', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2022-04-07', lastContactedAt: '2026-01-17T10:00:00.000Z', policyCount: 1, annualRevenue: 32000, email: 'yadkinlandscaping@gmail.com', phone: '(336) 555-0707', address: '775 Cedar Ln, Winston-Salem, NC 27101' },
  { isCommercial: true, name: 'Cape Fear Plumbing Inc.', primaryContact: 'Angela Davis', city: 'Wilmington', health: 'At risk', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2016-08-30', lastContactedAt: '2026-05-01T09:00:00.000Z', policyCount: 2, annualRevenue: 54000, email: 'capefearpluming@outlook.com', phone: '(910) 555-0808', address: '2290 Maple Dr, Wilmington, NC 28401' },
  { isCommercial: true, name: 'Sandhills Medical Group LLC', primaryContact: 'Matthew Johnson', city: 'Pinehurst', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2019-06-01', lastContactedAt: '2026-03-27T10:00:00.000Z', policyCount: 3, annualRevenue: 118000, email: 'sandhillsmedical@company.com', phone: '(910) 555-0909', address: '340 Pine Rd, Pinehurst, NC 28374' },
  { isCommercial: true, name: 'Catawba Auto Repair Inc.', primaryContact: 'Patricia Lewis', city: 'Hickory', health: 'Needs review', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2018-12-10', lastContactedAt: '2026-02-05T09:00:00.000Z', policyCount: 2, annualRevenue: 47000, email: 'catawbaauto@gmail.com', phone: '(828) 555-1010', address: '1900 Main St, Hickory, NC 28601' },
  // 11-20 Personal
  { isCommercial: false, name: 'James Whitfield', primaryContact: 'James Whitfield', city: 'Cary', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2021-06-15', lastContactedAt: '2026-04-18T10:00:00.000Z', policyCount: 2, annualRevenue: 4200, email: 'jameswhitfield@gmail.com', phone: '(919) 555-1101', address: '612 Sunset Blvd, Cary, NC 27511' },
  { isCommercial: false, name: 'Maria Santos', primaryContact: 'Maria Santos', city: 'Durham', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2020-03-22', lastContactedAt: '2026-01-29T09:00:00.000Z', policyCount: 2, annualRevenue: 3800, email: 'mariasantos@outlook.com', phone: '(984) 555-1202', address: '423 Oak Ave, Durham, NC 27701' },
  { isCommercial: false, name: 'Harold Turner', primaryContact: 'Harold Turner', city: 'Raleigh', health: 'Needs review', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2018-09-10', lastContactedAt: '2026-03-14T09:00:00.000Z', policyCount: 3, annualRevenue: 5600, email: 'haroldturner@yahoo.com', phone: '(919) 555-1303', address: '1204 Willow Creek Rd, Raleigh, NC 27601' },
  { isCommercial: false, name: 'Brenda Nguyen', primaryContact: 'Brenda Nguyen', city: 'Apex', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2022-01-05', lastContactedAt: '2026-04-25T10:00:00.000Z', policyCount: 2, annualRevenue: 4100, email: 'brendanguyen@icloud.com', phone: '(984) 555-1404', address: '88 Forest Hills Rd, Apex, NC 27502' },
  { isCommercial: false, name: 'Calvin Freeman', primaryContact: 'Calvin Freeman', city: 'Concord', health: 'At risk', accountStatus: 'Inactive', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2017-04-19', lastContactedAt: '2026-01-07T09:00:00.000Z', policyCount: 1, annualRevenue: 1600, email: 'calvinfreeman@gmail.com', phone: '(704) 555-1505', address: '2050 Elm St, Concord, NC 28025' },
  { isCommercial: false, name: 'Dorothy Walsh', primaryContact: 'Dorothy Walsh', city: 'Chapel Hill', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2023-07-30', lastContactedAt: '2026-05-10T10:00:00.000Z', policyCount: 2, annualRevenue: 4500, email: 'dorothywalsh@outlook.com', phone: '(984) 555-1606', address: '375 Park Blvd, Chapel Hill, NC 27514' },
  { isCommercial: false, name: 'Terrence Banks', primaryContact: 'Terrence Banks', city: 'Gastonia', health: 'Needs review', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2019-11-22', lastContactedAt: '2026-02-28T09:00:00.000Z', policyCount: 2, annualRevenue: 3500, email: 'terrencebanks@yahoo.com', phone: '(704) 555-1707', address: '940 Lake View Dr, Gastonia, NC 28052' },
  { isCommercial: false, name: 'Sylvia Crawford', primaryContact: 'Sylvia Crawford', city: 'Mooresville', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2024-02-14', lastContactedAt: '2026-04-08T09:00:00.000Z', policyCount: 2, annualRevenue: 4800, email: 'sylviacrawford@gmail.com', phone: '(704) 555-1808', address: '1550 Ridge Rd, Mooresville, NC 28115' },
  { isCommercial: false, name: 'Eugene Patterson', primaryContact: 'Eugene Patterson', city: 'Kannapolis', health: 'Needs review', accountStatus: 'Prospect', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2025-01-10', lastContactedAt: '2026-05-15T10:00:00.000Z', policyCount: 1, annualRevenue: 1900, email: 'eugenepatterson@hotmail.com', phone: '(704) 555-1909', address: '200 Maple Dr, Kannapolis, NC 28081' },
  { isCommercial: false, name: 'Loretta Simmons', primaryContact: 'Loretta Simmons', city: 'Matthews', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2021-09-03', lastContactedAt: '2026-03-31T09:00:00.000Z', policyCount: 2, annualRevenue: 4300, email: 'lorettasimmons@gmail.com', phone: '(704) 555-2000', address: '670 Old Salisbury Rd, Matthews, NC 28104' },
  // 21-30 Commercial
  { isCommercial: true, name: 'Uwharrie Painting LLC', primaryContact: 'Marcus Reed', city: 'Salisbury', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2020-05-19', lastContactedAt: '2026-02-12T09:00:00.000Z', policyCount: 2, annualRevenue: 41000, email: 'uwharriepainting@gmail.com', phone: '(704) 555-2101', address: '530 Main St, Salisbury, NC 28144' },
  { isCommercial: true, name: 'Longleaf Staffing Inc.', primaryContact: 'Valerie Cross', city: 'Raleigh', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2019-08-27', lastContactedAt: '2026-04-20T10:00:00.000Z', policyCount: 3, annualRevenue: 99000, email: 'longleafstaffing@corp.net', phone: '(919) 555-2202', address: '1800 Corporate Dr, Raleigh, NC 27601' },
  { isCommercial: true, name: 'Biltmore Security Group', primaryContact: 'Nathaniel Hayes', city: 'Asheville', health: 'Needs review', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2021-03-14', lastContactedAt: '2026-01-24T09:00:00.000Z', policyCount: 2, annualRevenue: 67000, email: 'biltmoresecurity@company.com', phone: '(828) 555-2303', address: '950 Gateway Blvd, Asheville, NC 28801' },
  { isCommercial: true, name: 'Hatteras Food Distribution LLC', primaryContact: 'Anita Perkins', city: 'Greenville', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2018-01-09', lastContactedAt: '2026-03-18T10:00:00.000Z', policyCount: 3, annualRevenue: 112000, email: 'hatterasfood@biz.net', phone: '(252) 555-2404', address: '2700 Industrial Blvd, Greenville, NC 27834' },
  { isCommercial: true, name: 'Dogwood Dental Associates', primaryContact: 'Philip Grant', city: 'High Point', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2022-06-03', lastContactedAt: '2026-04-07T09:00:00.000Z', policyCount: 2, annualRevenue: 88000, email: 'dogwooddental@outlook.com', phone: '(336) 555-2505', address: '410 Park Blvd, High Point, NC 27260' },
  { isCommercial: true, name: 'Pamlico Catering Co.', primaryContact: 'Tamara Elliott', city: 'New Bern', health: 'At risk', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2017-10-26', lastContactedAt: '2026-05-05T10:00:00.000Z', policyCount: 2, annualRevenue: 39000, email: 'pamlicocatering@gmail.com', phone: '(252) 555-2606', address: '110 Cedar Ln, New Bern, NC 28560' },
  { isCommercial: true, name: 'Croatan Manufacturing Corp.', primaryContact: 'Derek Murray', city: 'Jacksonville', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2016-03-22', lastContactedAt: '2026-02-18T09:00:00.000Z', policyCount: 3, annualRevenue: 115000, email: 'croatanmfg@corp.net', phone: '(910) 555-2707', address: '3100 Commerce Dr, Jacksonville, NC 28540' },
  { isCommercial: true, name: 'Brushy Mountain Welding LLC', primaryContact: 'Christine Moss', city: 'Statesville', health: 'Needs review', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2023-02-15', lastContactedAt: '2026-03-26T10:00:00.000Z', policyCount: 2, annualRevenue: 52000, email: 'brushymtnwelding@gmail.com', phone: '(704) 555-2808', address: '760 Ridge Rd, Statesville, NC 28677' },
  { isCommercial: true, name: 'Appalachian Pest Control Inc.', primaryContact: 'Nathan Webb', city: 'Boone', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2024-05-20', lastContactedAt: '2026-04-14T09:00:00.000Z', policyCount: 1, annualRevenue: 28000, email: 'appalachianpest@biz.net', phone: '(828) 555-2909', address: '185 Mountain View Dr, Boone, NC 28607' },
  { isCommercial: true, name: 'Chimney Rock Cleaning Services', primaryContact: 'Jessica Fowler', city: 'Gastonia', health: 'At risk', accountStatus: 'Inactive', producerId: USERS.james, csrId: USERS.avery, clientSince: '2016-11-08', lastContactedAt: '2026-01-10T09:00:00.000Z', policyCount: 1, annualRevenue: 18000, email: 'chimneyrockcleaning@yahoo.com', phone: '(704) 555-3000', address: '2220 Elm St, Gastonia, NC 28052' },
  // 31-40 Personal & Commercial mix
  { isCommercial: false, name: 'Raymond Vega', primaryContact: 'Raymond Vega', city: 'Burlington', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2022-08-17', lastContactedAt: '2026-04-29T10:00:00.000Z', policyCount: 2, annualRevenue: 4600, email: 'raymondvega@gmail.com', phone: '(336) 555-3101', address: '305 Oak Ave, Burlington, NC 27215' },
  { isCommercial: true, name: 'Hickory Grove Flooring LLC', primaryContact: 'Sandra Barker', city: 'Hickory', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2020-07-04', lastContactedAt: '2026-03-11T09:00:00.000Z', policyCount: 2, annualRevenue: 49000, email: 'hickorygroveflooring@company.com', phone: '(828) 555-3202', address: '1400 Technology Dr, Hickory, NC 28601' },
  { isCommercial: false, name: 'Alice Benson', primaryContact: 'Alice Benson', city: 'Huntersville', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2021-04-23', lastContactedAt: '2026-02-09T10:00:00.000Z', policyCount: 2, annualRevenue: 3900, email: 'alicebenson@icloud.com', phone: '(704) 555-3303', address: '725 Forest Hills Rd, Huntersville, NC 28078' },
  { isCommercial: true, name: 'Whitewater Real Estate Group', primaryContact: 'Douglas Holt', city: 'Charlotte', health: 'Needs review', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2019-05-11', lastContactedAt: '2026-01-21T09:00:00.000Z', policyCount: 3, annualRevenue: 97000, email: 'whitewaterrealty@corp.net', phone: '(704) 555-3404', address: '3300 Innovation Pkwy, Charlotte, NC 28201' },
  { isCommercial: false, name: 'Marcus Holloway', primaryContact: 'Marcus Holloway', city: 'Garner', health: 'Needs review', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2020-01-15', lastContactedAt: '2026-03-05T09:00:00.000Z', policyCount: 2, annualRevenue: 3600, email: 'marcusholloway@yahoo.com', phone: '(919) 555-3505', address: '870 Sunset Blvd, Garner, NC 27529' },
  { isCommercial: true, name: 'Ocracoke Logistics LLC', primaryContact: 'Tina Harrington', city: 'Wilmington', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2023-09-29', lastContactedAt: '2026-04-16T10:00:00.000Z', policyCount: 2, annualRevenue: 61000, email: 'ocracokelogistics@biz.net', phone: '(910) 555-3606', address: '540 Trade Center Dr, Wilmington, NC 28401' },
  { isCommercial: false, name: 'Elaine Fitzgerald', primaryContact: 'Elaine Fitzgerald', city: 'Wilson', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2018-06-06', lastContactedAt: '2026-02-25T09:00:00.000Z', policyCount: 2, annualRevenue: 4700, email: 'elainefitzgerald@gmail.com', phone: '(252) 555-3707', address: '1115 Park Blvd, Wilson, NC 27893' },
  { isCommercial: true, name: 'Mattamuskeet Property Management LLC', primaryContact: 'Gregory Sutton', city: 'Rocky Mount', health: 'Needs review', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2021-12-18', lastContactedAt: '2026-03-22T10:00:00.000Z', policyCount: 3, annualRevenue: 83000, email: 'mattamuskeetpm@company.com', phone: '(252) 555-3808', address: '2670 Commerce Dr, Rocky Mount, NC 27801' },
  { isCommercial: false, name: 'Victor Ochoa', primaryContact: 'Victor Ochoa', city: 'Sanford', health: 'At risk', accountStatus: 'Prospect', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2025-03-05', lastContactedAt: '2026-05-18T10:00:00.000Z', policyCount: 1, annualRevenue: 1400, email: 'victorochoa@gmail.com', phone: '(919) 555-3909', address: '390 Cedar Ln, Sanford, NC 27330' },
  { isCommercial: true, name: 'Hanging Rock Consulting Group', primaryContact: 'Pamela Stone', city: 'Winston-Salem', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2020-10-12', lastContactedAt: '2026-04-04T09:00:00.000Z', policyCount: 2, annualRevenue: 76000, email: 'hangingrockgroup@corp.net', phone: '(336) 555-4000', address: '1240 Business Park Way, Winston-Salem, NC 27101' },
  // 41-50
  { isCommercial: true, name: 'Guilford Printing Inc.', primaryContact: 'Brandon Carr', city: 'Greensboro', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2019-02-14', lastContactedAt: '2026-02-17T09:00:00.000Z', policyCount: 2, annualRevenue: 57000, email: 'guilfordprinting@biz.net', phone: '(336) 555-4101', address: '660 Guilford College Rd, Greensboro, NC 27401' },
  { isCommercial: false, name: 'Diane Morales', primaryContact: 'Diane Morales', city: 'Durham', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2023-04-27', lastContactedAt: '2026-03-28T10:00:00.000Z', policyCount: 2, annualRevenue: 4000, email: 'dianemorales@yahoo.com', phone: '(984) 555-4202', address: '218 Maple Dr, Durham, NC 27701' },
  { isCommercial: true, name: 'Triangle Restaurant Group LLC', primaryContact: 'Keith Austin', city: 'Raleigh', health: 'At risk', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2018-08-23', lastContactedAt: '2026-05-02T09:00:00.000Z', policyCount: 2, annualRevenue: 44000, email: 'trianglerestaurant@gmail.com', phone: '(919) 555-4303', address: '880 Main St, Raleigh, NC 27601' },
  { isCommercial: false, name: 'Ralph Zimmerman', primaryContact: 'Ralph Zimmerman', city: 'Monroe', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2022-10-01', lastContactedAt: '2026-04-12T10:00:00.000Z', policyCount: 2, annualRevenue: 3700, email: 'ralphzimmerman@hotmail.com', phone: '(704) 555-4404', address: '490 Oak Ave, Monroe, NC 28110' },
  { isCommercial: true, name: 'Kinston Inland Marine LLC', primaryContact: 'Yolanda Byrd', city: 'Goldsboro', health: 'Needs review', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2021-07-16', lastContactedAt: '2026-01-15T09:00:00.000Z', policyCount: 2, annualRevenue: 68000, email: 'kinstoninlandmarine@company.com', phone: '(919) 555-4505', address: '1330 Ridge Rd, Goldsboro, NC 27530' },
  { isCommercial: false, name: 'Gail Henderson', primaryContact: 'Gail Henderson', city: 'Apex', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2020-12-08', lastContactedAt: '2026-04-22T10:00:00.000Z', policyCount: 2, annualRevenue: 4400, email: 'gailhenderson@icloud.com', phone: '(984) 555-4606', address: '135 Willow Creek Rd, Apex, NC 27502' },
  { isCommercial: true, name: 'Kernersville Janitorial Services LLC', primaryContact: 'Reginald Fox', city: 'Kernersville', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2024-01-10', lastContactedAt: '2026-03-15T09:00:00.000Z', policyCount: 1, annualRevenue: 25000, email: 'kernersvillejanitorial@biz.net', phone: '(336) 555-4707', address: '450 Business Park Way, Kernersville, NC 27284' },
  { isCommercial: false, name: 'Shirley Barton', primaryContact: 'Shirley Barton', city: 'Concord', health: 'Needs review', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2019-03-30', lastContactedAt: '2026-02-07T10:00:00.000Z', policyCount: 2, annualRevenue: 3300, email: 'shirleybarton@gmail.com', phone: '(704) 555-4808', address: '780 Forest Hills Rd, Concord, NC 28025' },
  { isCommercial: true, name: 'Lumberton Welding Group', primaryContact: 'Albert Manning', city: 'Lumberton', health: 'Needs review', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2017-06-14', lastContactedAt: '2026-01-27T09:00:00.000Z', policyCount: 2, annualRevenue: 46000, email: 'lumbertonwelding@gmail.com', phone: '(910) 555-4909', address: '1900 Industrial Blvd, Lumberton, NC 28358' },
  { isCommercial: false, name: 'Frances Copeland', primaryContact: 'Frances Copeland', city: 'Chapel Hill', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2024-08-19', lastContactedAt: '2026-05-12T10:00:00.000Z', policyCount: 2, annualRevenue: 5100, email: 'francescopeland@outlook.com', phone: '(984) 555-5000', address: '290 New Garden Rd, Chapel Hill, NC 27514' },
  // 51-60
  { isCommercial: true, name: 'Piedmont Framing Corp.', primaryContact: 'George Rivera', city: 'Charlotte', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2020-04-01', lastContactedAt: '2026-03-09T09:00:00.000Z', policyCount: 3, annualRevenue: 96000, email: 'piedmontframing@corp.net', phone: '(704) 555-5101', address: '2100 Trade Center Dr, Charlotte, NC 28201' },
  { isCommercial: false, name: 'Clarence Wade', primaryContact: 'Clarence Wade', city: 'Thomasville', health: 'At risk', accountStatus: 'Inactive', producerId: USERS.james, csrId: USERS.avery, clientSince: '2016-09-17', lastContactedAt: '2026-01-03T09:00:00.000Z', policyCount: 1, annualRevenue: 1200, email: 'clarencewade@yahoo.com', phone: '(336) 555-5202', address: '600 Maple Dr, Thomasville, NC 27360' },
  { isCommercial: true, name: 'Coastal Auto Repair Inc.', primaryContact: 'Gwendolyn Hicks', city: 'Jacksonville', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2022-11-11', lastContactedAt: '2026-04-09T10:00:00.000Z', policyCount: 2, annualRevenue: 51000, email: 'coastalauto@biz.net', phone: '(910) 555-5303', address: '835 Gateway Blvd, Jacksonville, NC 28540' },
  { isCommercial: false, name: 'Josephine Tran', primaryContact: 'Josephine Tran', city: 'Cary', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2021-01-28', lastContactedAt: '2026-03-20T09:00:00.000Z', policyCount: 2, annualRevenue: 4900, email: 'josephinetran@gmail.com', phone: '(919) 555-5404', address: '460 Sunset Blvd, Cary, NC 27511' },
  { isCommercial: true, name: 'Neuse River Logistics LLC', primaryContact: 'Roberto Salinas', city: 'Raleigh', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2023-06-07', lastContactedAt: '2026-04-24T10:00:00.000Z', policyCount: 2, annualRevenue: 78000, email: 'neuseriverlogistics@company.com', phone: '(919) 555-5505', address: '1550 Corporate Dr, Raleigh, NC 27601' },
  { isCommercial: false, name: 'Evelyn Chambers', primaryContact: 'Evelyn Chambers', city: 'High Point', health: 'Needs review', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2020-06-20', lastContactedAt: '2026-02-03T09:00:00.000Z', policyCount: 2, annualRevenue: 3800, email: 'evelynchambers@hotmail.com', phone: '(336) 555-5606', address: '1010 Cedar Ln, High Point, NC 27260' },
  { isCommercial: true, name: 'Rocky Mount Staffing Solutions Inc.', primaryContact: 'Ivan Pope', city: 'Rocky Mount', health: 'Needs review', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2018-03-13', lastContactedAt: '2026-03-03T10:00:00.000Z', policyCount: 3, annualRevenue: 102000, email: 'rockymountstaffing@gmail.com', phone: '(252) 555-5707', address: '2900 Commerce Dr, Rocky Mount, NC 27801' },
  { isCommercial: false, name: 'Oscar Reyes', primaryContact: 'Oscar Reyes', city: 'Garner', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2024-03-21', lastContactedAt: '2026-04-30T09:00:00.000Z', policyCount: 2, annualRevenue: 4200, email: 'oscarreyes@gmail.com', phone: '(919) 555-5808', address: '320 Oak Ave, Garner, NC 27529' },
  { isCommercial: true, name: 'Tarheel Electrical Services LLC', primaryContact: 'Nadine Cruz', city: 'Durham', health: 'At risk', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2017-01-30', lastContactedAt: '2026-05-06T10:00:00.000Z', policyCount: 2, annualRevenue: 55000, email: 'tarheelelectrical@biz.net', phone: '(984) 555-5909', address: '750 Battleground Ave, Durham, NC 27701' },
  { isCommercial: false, name: 'Harriet Lawson', primaryContact: 'Harriet Lawson', city: 'Huntersville', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2022-07-05', lastContactedAt: '2026-04-01T09:00:00.000Z', policyCount: 2, annualRevenue: 4100, email: 'harrietlawson@icloud.com', phone: '(704) 555-6000', address: '900 Forest Hills Rd, Huntersville, NC 28078' },
  // 61-70
  { isCommercial: true, name: 'Waxhaw Concrete Solutions Inc.', primaryContact: 'Curtis Norris', city: 'Monroe', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2019-10-04', lastContactedAt: '2026-02-26T09:00:00.000Z', policyCount: 2, annualRevenue: 59000, email: 'waxhawconcrete@company.com', phone: '(704) 555-6101', address: '1700 Commerce Dr, Monroe, NC 28110' },
  { isCommercial: false, name: 'Annette Thornton', primaryContact: 'Annette Thornton', city: 'Burlington', health: 'Needs review', accountStatus: 'Prospect', producerId: USERS.james, csrId: USERS.avery, clientSince: '2025-02-18', lastContactedAt: '2026-05-16T10:00:00.000Z', policyCount: 1, annualRevenue: 1800, email: 'annettethornton@gmail.com', phone: '(336) 555-6202', address: '225 Park Blvd, Burlington, NC 27215' },
  { isCommercial: true, name: 'Sanford Framing Partners LLC', primaryContact: 'Lionel Maxwell', city: 'Sanford', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2021-08-08', lastContactedAt: '2026-03-17T09:00:00.000Z', policyCount: 2, annualRevenue: 63000, email: 'sanfordframing@biz.net', phone: '(919) 555-6303', address: '480 Ridge Rd, Sanford, NC 27330' },
  { isCommercial: false, name: 'Todd Cunningham', primaryContact: 'Todd Cunningham', city: 'Kannapolis', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2023-11-14', lastContactedAt: '2026-04-06T10:00:00.000Z', policyCount: 2, annualRevenue: 3500, email: 'toddcunningham@yahoo.com', phone: '(704) 555-6404', address: '640 Lake View Dr, Kannapolis, NC 28081' },
  { isCommercial: true, name: 'Greensboro Consulting Services LLC', primaryContact: 'Helen Spencer', city: 'Greensboro', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2018-04-25', lastContactedAt: '2026-02-21T09:00:00.000Z', policyCount: 2, annualRevenue: 80000, email: 'greensboroconsulting@corp.net', phone: '(336) 555-6505', address: '320 New Garden Rd, Greensboro, NC 27401' },
  { isCommercial: false, name: 'Vivian Hooper', primaryContact: 'Vivian Hooper', city: 'Statesville', health: 'At risk', accountStatus: 'Inactive', producerId: USERS.james, csrId: USERS.avery, clientSince: '2016-05-10', lastContactedAt: '2026-01-13T09:00:00.000Z', policyCount: 1, annualRevenue: 1300, email: 'vivianhooper@gmail.com', phone: '(704) 555-6606', address: '155 Willow Creek Rd, Statesville, NC 28677' },
  { isCommercial: true, name: 'Currituck Wind Energy Corp.', primaryContact: 'Jerome Mcdonald', city: 'Jacksonville', health: 'Needs review', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2022-03-03', lastContactedAt: '2026-03-30T10:00:00.000Z', policyCount: 2, annualRevenue: 74000, email: 'currituckwind@company.com', phone: '(910) 555-6707', address: '1100 Innovation Pkwy, Jacksonville, NC 28540' },
  { isCommercial: false, name: 'Harvey Fitzgerald', primaryContact: 'Harvey Fitzgerald', city: 'Cary', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2021-05-25', lastContactedAt: '2026-04-23T09:00:00.000Z', policyCount: 2, annualRevenue: 4800, email: 'harveyfitzgerald@hotmail.com', phone: '(919) 555-6808', address: '505 Forest Hills Rd, Cary, NC 27511' },
  { isCommercial: true, name: 'Old Salem Bakery Inc.', primaryContact: 'Rosemary Diaz', city: 'Winston-Salem', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2020-02-19', lastContactedAt: '2026-02-11T09:00:00.000Z', policyCount: 2, annualRevenue: 36000, email: 'oldsalembakery@gmail.com', phone: '(336) 555-6909', address: '730 Main St, Winston-Salem, NC 27101' },
  { isCommercial: false, name: 'Wendell Tatum', primaryContact: 'Wendell Tatum', city: 'Goldsboro', health: 'Needs review', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2019-07-31', lastContactedAt: '2026-03-23T10:00:00.000Z', policyCount: 2, annualRevenue: 3400, email: 'wendelltatum@gmail.com', phone: '(919) 555-7000', address: '815 Cedar Ln, Goldsboro, NC 27530' },
  // 71-80
  { isCommercial: true, name: 'Triad Landscape Partners LLC', primaryContact: 'Candice Osborne', city: 'Greensboro', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2023-01-06', lastContactedAt: '2026-04-17T09:00:00.000Z', policyCount: 2, annualRevenue: 43000, email: 'triadlandscape@biz.net', phone: '(336) 555-7101', address: '1960 Guilford College Rd, Greensboro, NC 27401' },
  { isCommercial: false, name: 'Russell Espinoza', primaryContact: 'Russell Espinoza', city: 'Asheville', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2022-05-12', lastContactedAt: '2026-04-27T10:00:00.000Z', policyCount: 2, annualRevenue: 5300, email: 'russelespinoza@yahoo.com', phone: '(828) 555-7202', address: '360 Mountain View Dr, Asheville, NC 28801' },
  { isCommercial: true, name: 'Pinehurst Property Management LLC', primaryContact: 'Wanda Dennis', city: 'Pinehurst', health: 'Needs review', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2020-08-15', lastContactedAt: '2026-01-31T09:00:00.000Z', policyCount: 3, annualRevenue: 91000, email: 'pinehurstpm@company.com', phone: '(910) 555-7303', address: '620 Pine Rd, Pinehurst, NC 28374' },
  { isCommercial: false, name: 'Carolyn Garrett', primaryContact: 'Carolyn Garrett', city: 'Fayetteville', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2021-10-28', lastContactedAt: '2026-03-10T10:00:00.000Z', policyCount: 2, annualRevenue: 3900, email: 'carolyngarrett@gmail.com', phone: '(910) 555-7404', address: '1470 Elm St, Fayetteville, NC 28301' },
  { isCommercial: true, name: 'Eastwood Demolition Corp.', primaryContact: 'Edwin Lamb', city: 'Concord', health: 'At risk', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2017-02-05', lastContactedAt: '2026-05-08T09:00:00.000Z', policyCount: 2, annualRevenue: 70000, email: 'eastwooddemolition@corp.net', phone: '(704) 555-7505', address: '2250 Industrial Blvd, Concord, NC 28025' },
  { isCommercial: false, name: 'Mildred Walters', primaryContact: 'Mildred Walters', city: 'Matthews', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2023-08-22', lastContactedAt: '2026-04-13T10:00:00.000Z', policyCount: 2, annualRevenue: 4300, email: 'mildredwalters@outlook.com', phone: '(704) 555-7606', address: '780 Sunset Blvd, Matthews, NC 28104' },
  { isCommercial: true, name: 'Hoke County HVAC Services Inc.', primaryContact: 'Jerome Thornton', city: 'Lumberton', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2024-04-01', lastContactedAt: '2026-03-24T09:00:00.000Z', policyCount: 1, annualRevenue: 30000, email: 'hokecountyhvac@biz.net', phone: '(910) 555-7707', address: '340 Gateway Blvd, Lumberton, NC 28358' },
  { isCommercial: false, name: 'Leon Byrd', primaryContact: 'Leon Byrd', city: 'Mooresville', health: 'Needs review', accountStatus: 'Prospect', producerId: USERS.james, csrId: USERS.avery, clientSince: '2025-05-01', lastContactedAt: '2026-05-20T10:00:00.000Z', policyCount: 1, annualRevenue: 1700, email: 'leonbyrd@gmail.com', phone: '(704) 555-7808', address: '180 Ridge Rd, Mooresville, NC 28115' },
  { isCommercial: true, name: 'Nash County Transportation LLC', primaryContact: 'Barbara Watkins', city: 'Rocky Mount', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2019-01-20', lastContactedAt: '2026-02-19T09:00:00.000Z', policyCount: 2, annualRevenue: 85000, email: 'nashcountytransport@gmail.com', phone: '(252) 555-7909', address: '3400 Commerce Dr, Rocky Mount, NC 27801' },
  { isCommercial: false, name: 'Florence Nunez', primaryContact: 'Florence Nunez', city: 'Raleigh', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2022-09-11', lastContactedAt: '2026-04-05T09:00:00.000Z', policyCount: 2, annualRevenue: 4600, email: 'florencenunez@icloud.com', phone: '(919) 555-8000', address: '1120 Technology Dr, Raleigh, NC 27601' },
  // 81-90
  { isCommercial: true, name: 'Sandhills Printing Services Inc.', primaryContact: 'Carlton Hood', city: 'Pinehurst', health: 'Needs review', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2021-06-30', lastContactedAt: '2026-01-26T09:00:00.000Z', policyCount: 2, annualRevenue: 48000, email: 'sandhillsprinting@company.com', phone: '(910) 555-8101', address: '510 Commerce Dr, Pinehurst, NC 28374' },
  { isCommercial: false, name: 'Cecelia Potter', primaryContact: 'Cecelia Potter', city: 'Kernersville', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2020-03-07', lastContactedAt: '2026-03-16T10:00:00.000Z', policyCount: 2, annualRevenue: 4000, email: 'ceeliapotter@gmail.com', phone: '(336) 555-8202', address: '275 Park Blvd, Kernersville, NC 27284' },
  { isCommercial: true, name: 'Forsyth Metal Fabrication LLC', primaryContact: 'Cornelius Sharp', city: 'Winston-Salem', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2018-11-17', lastContactedAt: '2026-04-10T09:00:00.000Z', policyCount: 3, annualRevenue: 110000, email: 'forsythmetalfab@corp.net', phone: '(336) 555-8303', address: '1600 Industrial Blvd, Winston-Salem, NC 27101' },
  { isCommercial: false, name: 'Gilbert Ortega', primaryContact: 'Gilbert Ortega', city: 'Wilmington', health: 'Needs review', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2019-09-16', lastContactedAt: '2026-02-14T10:00:00.000Z', policyCount: 2, annualRevenue: 3600, email: 'gilbertortega@yahoo.com', phone: '(910) 555-8404', address: '880 Lake View Dr, Wilmington, NC 28401' },
  { isCommercial: true, name: 'Duplin County Farm Supply Corp.', primaryContact: 'Shirley Floyd', city: 'Jacksonville', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2017-07-25', lastContactedAt: '2026-03-06T09:00:00.000Z', policyCount: 2, annualRevenue: 66000, email: 'duplinfarm@company.com', phone: '(910) 555-8505', address: '2500 Business Park Way, Jacksonville, NC 28540' },
  { isCommercial: false, name: 'Miriam Caldwell', primaryContact: 'Miriam Caldwell', city: 'Gastonia', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2024-07-03', lastContactedAt: '2026-04-28T10:00:00.000Z', policyCount: 2, annualRevenue: 4200, email: 'miriamcaldwell@gmail.com', phone: '(704) 555-8606', address: '1290 Maple Dr, Gastonia, NC 28052' },
  { isCommercial: true, name: 'High Country Electrical Corp.', primaryContact: 'Alfred Gill', city: 'Asheville', health: 'At risk', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2016-10-03', lastContactedAt: '2026-05-07T09:00:00.000Z', policyCount: 2, annualRevenue: 57000, email: 'highcountryelectric@biz.net', phone: '(828) 555-8707', address: '1010 Ridge Rd, Asheville, NC 28801' },
  { isCommercial: false, name: 'Rhonda Payne', primaryContact: 'Rhonda Payne', city: 'New Bern', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2022-12-19', lastContactedAt: '2026-04-15T10:00:00.000Z', policyCount: 2, annualRevenue: 4500, email: 'rhondapayne@hotmail.com', phone: '(252) 555-8808', address: '645 Forest Hills Rd, New Bern, NC 28560' },
  { isCommercial: true, name: 'Robeson Staffing Inc.', primaryContact: 'Leon Walton', city: 'Lumberton', health: 'Needs review', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2021-04-10', lastContactedAt: '2026-02-24T09:00:00.000Z', policyCount: 2, annualRevenue: 73000, email: 'robesonstaffing@gmail.com', phone: '(910) 555-8909', address: '2160 Commerce Dr, Lumberton, NC 28358' },
  { isCommercial: false, name: 'Constance Miles', primaryContact: 'Constance Miles', city: 'Wilson', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2023-10-24', lastContactedAt: '2026-04-21T10:00:00.000Z', policyCount: 2, annualRevenue: 4700, email: 'constancemiles@outlook.com', phone: '(252) 555-9000', address: '395 Oak Ave, Wilson, NC 27893' },
  // 91-100
  { isCommercial: true, name: 'Guilford County Roofing LLC', primaryContact: 'Nathaniel Pierce', city: 'Greensboro', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2020-11-19', lastContactedAt: '2026-03-01T09:00:00.000Z', policyCount: 2, annualRevenue: 62000, email: 'guilfordroofing@biz.net', phone: '(336) 555-9101', address: '1750 Commerce Dr, Greensboro, NC 27401' },
  { isCommercial: false, name: 'Aubrey Jennings', primaryContact: 'Aubrey Jennings', city: 'Durham', health: 'Needs review', accountStatus: 'Prospect', producerId: USERS.james, csrId: USERS.avery, clientSince: '2025-04-08', lastContactedAt: '2026-05-19T10:00:00.000Z', policyCount: 1, annualRevenue: 1600, email: 'aubreyjennings@gmail.com', phone: '(984) 555-9202', address: '730 Willow Creek Rd, Durham, NC 27701' },
  { isCommercial: true, name: 'Onslow Marine Services LLC', primaryContact: 'Theodore Gross', city: 'Jacksonville', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2019-04-14', lastContactedAt: '2026-02-16T09:00:00.000Z', policyCount: 2, annualRevenue: 69000, email: 'onslowmarine@company.com', phone: '(910) 555-9303', address: '900 Industrial Blvd, Jacksonville, NC 28540' },
  { isCommercial: false, name: 'Ingrid Hollins', primaryContact: 'Ingrid Hollins', city: 'Raleigh', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2021-11-07', lastContactedAt: '2026-03-29T10:00:00.000Z', policyCount: 2, annualRevenue: 4400, email: 'ingridhollins@icloud.com', phone: '(919) 555-9404', address: '1865 New Garden Rd, Raleigh, NC 27601' },
  { isCommercial: true, name: 'Sampson County Logistics Corp.', primaryContact: 'Gertrude Reeves', city: 'Goldsboro', health: 'Needs review', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2022-02-22', lastContactedAt: '2026-01-19T09:00:00.000Z', policyCount: 2, annualRevenue: 79000, email: 'sampsoncountylogistics@corp.net', phone: '(919) 555-9505', address: '1420 Business Park Way, Goldsboro, NC 27530' },
  { isCommercial: false, name: 'Dwayne Church', primaryContact: 'Dwayne Church', city: 'Hickory', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2020-04-18', lastContactedAt: '2026-04-03T09:00:00.000Z', policyCount: 2, annualRevenue: 3800, email: 'dwaynechurch@gmail.com', phone: '(828) 555-9606', address: '1035 Sunset Blvd, Hickory, NC 28601' },
  { isCommercial: true, name: 'Cabarrus Cleaning Services Inc.', primaryContact: 'Phyllis Nunez', city: 'Concord', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2024-06-16', lastContactedAt: '2026-04-26T10:00:00.000Z', policyCount: 1, annualRevenue: 27000, email: 'cabarruscleaning@biz.net', phone: '(704) 555-9707', address: '870 Technology Dr, Concord, NC 28025' },
  { isCommercial: false, name: 'Paulette Griffith', primaryContact: 'Paulette Griffith', city: 'Burlington', health: 'At risk', accountStatus: 'Inactive', producerId: USERS.james, csrId: USERS.avery, clientSince: '2016-07-14', lastContactedAt: '2026-01-08T09:00:00.000Z', policyCount: 1, annualRevenue: 1100, email: 'paulettegriffith@yahoo.com', phone: '(336) 555-9808', address: '300 Maple Dr, Burlington, NC 27215' },
  { isCommercial: true, name: 'Blue Ridge IT Solutions LLC', primaryContact: 'Terrence Cobb', city: 'Asheville', health: 'Strong', accountStatus: 'Active', producerId: USERS.mia, csrId: USERS.evan, clientSince: '2023-03-31', lastContactedAt: '2026-04-02T09:00:00.000Z', policyCount: 2, annualRevenue: 84000, email: 'blueridgeit@company.com', phone: '(828) 555-9909', address: '1230 Innovation Pkwy, Asheville, NC 28801' },
  { isCommercial: false, name: 'Norma Petersen', primaryContact: 'Norma Petersen', city: 'Chapel Hill', health: 'Strong', accountStatus: 'Active', producerId: USERS.james, csrId: USERS.avery, clientSince: '2022-06-09', lastContactedAt: '2026-04-19T10:00:00.000Z', policyCount: 2, annualRevenue: 5000, email: 'normapetersen@gmail.com', phone: '(984) 555-0010', address: '570 Battleground Ave, Chapel Hill, NC 27514' },
]

// ─── Policy templates ─────────────────────────────────────────────────────────

interface PolicyTemplate {
  carrier: string
  policyType: string
  premium: number
  commissionRate: number
  effectiveDate: string
  expirationDate: string
  status: Policy['status']
  billingType: 'Direct Bill' | 'Agency Bill' | 'Financed'
  policyNumber: string
}

const POLICY_STATUS_OPTIONS: Policy['status'][] = [
  'Active', 'Active', 'Active', 'Active', 'Active',
  'Renewal review', 'Renewal review',
  'Expired', 'Cancelled',
]

function makePolicyNumber(index: number, sub: number): string {
  const prefixes = ['CPP', 'CGL', 'WC', 'BOP', 'CAU', 'PAU', 'HO', 'UMB', 'PLI', 'IMP']
  const p = prefixes[index % prefixes.length]
  return `${p}-${String(2025 + (sub % 2))}-${String(index * 13 + sub * 7).padStart(6, '0')}`
}

function makePolicyTemplate(
  clientIndex: number,
  policyIndex: number,
  isCommercial: boolean,
): PolicyTemplate {
  const types = isCommercial ? POLICY_TYPES_COMMERCIAL : POLICY_TYPES_PERSONAL
  const policyType = types[(clientIndex * 3 + policyIndex) % types.length]

  const carrier = CARRIERS[(clientIndex * 7 + policyIndex * 3) % CARRIERS.length]

  let premium: number
  if (isCommercial) {
    const base = 8000 + ((clientIndex * 1117 + policyIndex * 613) % 112001)
    premium = Math.round(base / 100) * 100
  } else {
    const base = 800 + ((clientIndex * 431 + policyIndex * 173) % 5201)
    premium = Math.round(base / 50) * 50
  }

  const commissionRate = 9 + ((clientIndex + policyIndex) % 7)

  // Spread effective dates across 2024-2025 range
  const effYear = 2025
  const effMonth = 1 + ((clientIndex * 3 + policyIndex) % 12)
  const effDay = 1 + (clientIndex % 28)
  const effectiveDate = dateStr(effYear, effMonth, effDay)
  const expirationDate = addDays(effectiveDate, 365)

  const statusIdx = (clientIndex * 5 + policyIndex * 11) % POLICY_STATUS_OPTIONS.length
  const status = POLICY_STATUS_OPTIONS[statusIdx]

  const billingTypes: Array<'Direct Bill' | 'Agency Bill' | 'Financed'> = [
    'Direct Bill', 'Direct Bill', 'Agency Bill', 'Financed',
  ]
  const billingType = billingTypes[(clientIndex + policyIndex) % billingTypes.length]

  return {
    carrier,
    policyType,
    premium,
    commissionRate,
    effectiveDate,
    expirationDate,
    status,
    billingType,
    policyNumber: makePolicyNumber(clientIndex, policyIndex),
  }
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function createBulkSeedData(): {
  clients: Client[]
  policies: Policy[]
  renewals: Renewal[]
  tasks: Task[]
  notes: ClientNote[]
} {
  const clients: Client[] = []
  const policies: Policy[] = []
  const renewals: Renewal[] = []
  const tasks: Task[] = []
  const notes: ClientNote[] = []

  // ── Build clients & policies ──────────────────────────────────────────────

  // Each entry maps to client-bulk-001 through client-bulk-100
  RAW_CLIENTS.forEach((raw, i) => {
    const idx = i + 1
    const clientId = `client-bulk-${pad(idx)}`

    const lob = raw.isCommercial ? 'Commercial' : 'Personal lines'
    const clientStatus: 'Client' | 'Prospect' =
      raw.accountStatus === 'Prospect' ? 'Prospect' : 'Client'

    const client: Client = {
      id: clientId,
      accountId: ACCOUNT_ID,
      ownerUserId: USERS.ronny,
      assignedProducerId: raw.producerId,
      assignedCsrId: raw.csrId,
      name: raw.name,
      primaryContact: raw.primaryContact,
      status: clientStatus,
      accountStatus: raw.accountStatus,
      lineOfBusiness: lob,
      email: raw.email,
      phone: raw.phone,
      mailingAddress: raw.address,
      physicalAddress: raw.address,
      policyCount: raw.policyCount,
      annualRevenue: raw.annualRevenue,
      health: raw.health,
      clientSince: raw.clientSince,
      lastContactedAt: raw.lastContactedAt,
      preferredContactMethod: (['Phone', 'Email', 'Email', 'Phone', 'Portal'] as const)[idx % 5],
    }
    clients.push(client)

    // Generate 1-3 policies per client
    const numPolicies = raw.policyCount > 2 ? 3 : raw.policyCount === 2 ? 2 : 1
    for (let p = 0; p < numPolicies; p++) {
      const tmpl = makePolicyTemplate(idx, p, raw.isCommercial)
      const suffix = String.fromCharCode(97 + p) // a, b, c
      const policyId = `bulk-pol-${pad(idx)}-${suffix}`

      const policy: Policy = {
        id: policyId,
        accountId: ACCOUNT_ID,
        clientId,
        carrier: tmpl.carrier,
        policyType: tmpl.policyType,
        lineOfBusiness: lob,
        policyNumber: tmpl.policyNumber,
        effectiveDate: tmpl.effectiveDate,
        expirationDate: tmpl.expirationDate,
        premium: tmpl.premium,
        commissionRate: tmpl.commissionRate,
        billingType: tmpl.billingType,
        paymentStatus: (['Current', 'Current', 'Current', 'Due soon', 'Past due'] as const)[
          (idx + p) % 5
        ],
        status: tmpl.status,
        producerUserId: raw.producerId,
        csrUserId: raw.csrId,
      }
      policies.push(policy)
    }
  })

  // ── Build renewals (~25) ─────────────────────────────────────────────────

  // Pick policies with Renewal review status
  const renewalCandidates = policies.filter((pol) => pol.status === 'Renewal review')

  const renewalStatuses: Renewal['status'][] = [
    'Review docs', 'Quote pending', 'Client outreach', 'Ready to bind',
  ]

  // Build due dates spread Jun-Dec 2026
  const dueDates = [
    '2026-06-05', '2026-06-18', '2026-07-02', '2026-07-15', '2026-07-28',
    '2026-08-08', '2026-08-21', '2026-09-03', '2026-09-17', '2026-09-30',
    '2026-10-10', '2026-10-23', '2026-11-05', '2026-11-18', '2026-12-01',
    '2026-12-12', '2026-12-22', '2026-06-12', '2026-07-09', '2026-08-14',
    '2026-09-09', '2026-10-06', '2026-11-11', '2026-12-08', '2026-06-28',
  ]

  const maxRenewals = Math.min(25, renewalCandidates.length, dueDates.length)
  for (let r = 0; r < maxRenewals; r++) {
    const pol = renewalCandidates[r]
    const renewal: Renewal = {
      id: `bulk-renewal-${pad(r + 1)}`,
      accountId: ACCOUNT_ID,
      clientId: pol.clientId,
      policyId: pol.id,
      dueDate: dueDates[r],
      status: renewalStatuses[r % renewalStatuses.length],
    }
    renewals.push(renewal)
  }

  // ── Build tasks (~40) ─────────────────────────────────────────────────────

  const taskTemplates: Array<{ title: string; dueLabel: string }> = [
    { title: 'Follow-up call — discuss renewal options', dueLabel: 'This week' },
    { title: 'Request updated driver list', dueLabel: 'Due soon' },
    { title: 'Certificate of insurance request pending', dueLabel: 'Urgent' },
    { title: 'Payment follow-up — past due balance', dueLabel: 'Overdue' },
    { title: 'Request renewal documents from insured', dueLabel: 'This week' },
    { title: 'Confirm coverage limits with client', dueLabel: 'Due soon' },
    { title: 'Quote follow-up — BOP renewal', dueLabel: 'This week' },
    { title: 'Review loss runs with client', dueLabel: 'Next week' },
    { title: 'Send renewal comparison worksheet', dueLabel: 'This week' },
    { title: 'Collect signed application', dueLabel: 'Urgent' },
    { title: 'Follow up on outstanding endorsement request', dueLabel: 'Due soon' },
    { title: 'Verify payroll figures for WC audit', dueLabel: 'Next week' },
    { title: 'Send cancellation notice follow-up', dueLabel: 'Overdue' },
    { title: 'Request updated vehicle schedule', dueLabel: 'This week' },
    { title: 'Follow up on missing down payment', dueLabel: 'Overdue' },
    { title: 'Schedule annual review call', dueLabel: 'Next month' },
    { title: 'Obtain ACORD 130 for workers comp renewal', dueLabel: 'This week' },
    { title: 'Confirm mortgagee clause change', dueLabel: 'Due soon' },
    { title: 'Quote follow-up — commercial auto', dueLabel: 'This week' },
    { title: 'Request property photos for underwriting', dueLabel: 'Next week' },
    { title: 'Follow-up on open claim — status check', dueLabel: 'Due soon' },
    { title: 'Email loss run request to carrier', dueLabel: 'This week' },
    { title: 'Remind client of upcoming audit', dueLabel: 'Next week' },
    { title: 'Obtain signed premium finance agreement', dueLabel: 'Urgent' },
    { title: 'Certificate request — sub-contractor', dueLabel: 'Urgent' },
    { title: 'Follow up on lapse in coverage', dueLabel: 'Overdue' },
    { title: 'Review umbrella limits with client', dueLabel: 'Next month' },
    { title: 'Collect employee count for BOP renewal', dueLabel: 'This week' },
    { title: 'Send GL quote options for review', dueLabel: 'Due soon' },
    { title: 'Confirm property square footage update', dueLabel: 'This week' },
    { title: 'Payment plan setup — new policy', dueLabel: 'Urgent' },
    { title: 'Review professional liability exclusions with client', dueLabel: 'Next week' },
    { title: 'Quote follow-up — homeowners renewal', dueLabel: 'This week' },
    { title: 'Request updated statement of values', dueLabel: 'Due soon' },
    { title: 'Follow-up call after non-renewal notice', dueLabel: 'Overdue' },
    { title: 'Obtain signed consent for electronic delivery', dueLabel: 'Next week' },
    { title: 'Verify additional insured on GL policy', dueLabel: 'This week' },
    { title: 'Send auto ID cards to client', dueLabel: 'Due soon' },
    { title: 'Follow up on commercial property inspection', dueLabel: 'Next week' },
    { title: 'Collect liquor license copy for carrier', dueLabel: 'This week' },
  ]

  const taskDueDates = [
    '2026-05-22', '2026-05-26', '2026-05-29', '2026-06-02', '2026-06-06',
    '2026-06-10', '2026-06-13', '2026-06-17', '2026-06-20', '2026-06-24',
    '2026-06-27', '2026-07-01', '2026-07-05', '2026-07-08', '2026-07-12',
    '2026-07-15', '2026-07-19', '2026-07-22', '2026-07-25', '2026-07-29',
    '2026-05-24', '2026-05-28', '2026-06-03', '2026-06-08', '2026-06-15',
    '2026-06-22', '2026-06-29', '2026-07-03', '2026-07-10', '2026-07-17',
    '2026-05-21', '2026-05-25', '2026-06-01', '2026-06-07', '2026-06-14',
    '2026-06-21', '2026-06-28', '2026-07-06', '2026-07-14', '2026-07-31',
  ]

  const priorities: Array<Task['priority']> = [
    'Low', 'Normal', 'Normal', 'Medium', 'Medium', 'High', 'Urgent',
  ]

  // Spread tasks across the first 40 clients
  for (let t = 0; t < 40; t++) {
    const clientIdx = (t * 2 + 5) % 100 // spread across clients
    const clientId = `client-bulk-${pad(clientIdx + 1)}`
    const tmpl = taskTemplates[t]
    const assignee = ALL_USER_IDS[t % ALL_USER_IDS.length]
    const creator = ALL_USER_IDS[(t + 2) % ALL_USER_IDS.length]

    const task: Task = {
      id: `bulk-task-${pad(t + 1)}`,
      accountId: ACCOUNT_ID,
      clientId,
      assignedToUserId: assignee,
      createdByUserId: creator,
      title: tmpl.title,
      dueLabel: tmpl.dueLabel,
      dueDate: taskDueDates[t],
      priority: priorities[(t * 3) % priorities.length],
      completed: t % 7 === 0, // every 7th task is completed (~5-6 completed)
      status: t % 7 === 0 ? 'Completed' : t % 4 === 0 ? 'In Progress' : 'Open',
    }
    tasks.push(task)
  }

  // ── Build notes (~30) ─────────────────────────────────────────────────────

  const noteTypes: Array<ClientNote['type']> = [
    'General', 'Renewal', 'Payment', 'Claim', 'Underwriting', 'Follow-up',
  ]

  const noteBodies: string[] = [
    'Spoke with insured regarding upcoming renewal. Client is satisfied with current carrier and coverage. Will prepare renewal proposal.',
    'Received updated payroll figures for workers compensation audit. Submitted to carrier for final audit calculation.',
    'Client called to request certificate of insurance for new general contractor. Certificate issued and emailed.',
    'Reviewed loss runs with client — two minor claims in the past 3 years. Carrier is comfortable with renewal.',
    'Left voicemail for insured regarding past due payment. Will follow up via email if no response by end of week.',
    'Client reported a slip-and-fall incident at their premises. Reported to carrier and opened claim #CL-2026-0471.',
    'Quoted BOP renewal through three carriers. Presented options to client — they prefer to stay with current carrier pending rate review.',
    'Discussed umbrella limits with client; recommended increasing from $1M to $2M based on business growth.',
    'Received notice of cancellation for non-payment. Called insured immediately — payment resolved same day.',
    'Annual policy review completed. No significant changes to operations. Renewed all three lines with incumbent carriers.',
    'Client moving business location. Need to update property address on all policies and notify carriers.',
    'Obtained signed waiver of subrogation endorsement for client\'s new construction contract.',
    'Received request to add new vehicle to commercial auto policy. Endorsed and sent updated ID cards.',
    'Follow-up on open underwriting question regarding client\'s prior carrier loss history. Awaiting carrier response.',
    'Client inquired about professional liability coverage for new consulting division. Preparing quote.',
    'Sent renewal documents via portal. Client acknowledged receipt. Will review and call back this week.',
    'Carrier inspection scheduled for next month. Advised client to ensure property is in good repair.',
    'Client asked about premium financing options. Sent comparison from two finance companies.',
    'New endorsement added: hired and non-owned auto coverage on GL policy per client request.',
    'Spoke with client regarding claim dispute — contacting claims adjuster for status update.',
    'Confirmed coverage is bound for new location. Binder sent to mortgage company.',
    'Received driver MVR results — one driver had minor infraction. No material impact on rate.',
    'Client called to cancel a secondary auto policy. Processed cancellation per request.',
    'Renewal quote received from carrier — 8% increase. Preparing market comparison for client review.',
    'Client reported hail damage to commercial roof. Claim reported, adjuster scheduled within 5 days.',
    'Added additional insured (general contractor) to GL policy for project starting next month.',
    'Discussed liquor liability exposure with restaurant owner. Recommended dedicated liquor liability policy.',
    'Client updated business description — added light manufacturing. Sent to underwriter for review.',
    'Reviewed inland marine schedule with client — added two new pieces of equipment.',
    'New client onboarded. All policies transferred from prior agency. Welcome packet sent.',
  ]

  const noteCreatedDates: string[] = [
    '2026-01-08T10:30:00.000Z', '2026-01-15T14:00:00.000Z', '2026-01-22T09:15:00.000Z',
    '2026-02-03T11:00:00.000Z', '2026-02-11T15:30:00.000Z', '2026-02-18T09:45:00.000Z',
    '2026-02-25T13:00:00.000Z', '2026-03-04T10:00:00.000Z', '2026-03-11T16:00:00.000Z',
    '2026-03-18T09:30:00.000Z', '2026-03-25T14:30:00.000Z', '2026-04-01T11:15:00.000Z',
    '2026-04-08T09:00:00.000Z', '2026-04-14T13:45:00.000Z', '2026-04-20T10:30:00.000Z',
    '2026-04-25T15:00:00.000Z', '2026-04-29T09:15:00.000Z', '2026-05-02T14:00:00.000Z',
    '2026-05-06T10:45:00.000Z', '2026-05-09T09:00:00.000Z', '2026-05-12T11:30:00.000Z',
    '2026-05-14T14:30:00.000Z', '2026-05-16T09:45:00.000Z', '2026-05-19T13:00:00.000Z',
    '2026-05-21T10:00:00.000Z', '2026-01-29T11:00:00.000Z', '2026-02-06T14:15:00.000Z',
    '2026-03-02T09:30:00.000Z', '2026-04-05T16:30:00.000Z', '2026-05-10T11:45:00.000Z',
  ]

  // Spread notes across different clients
  const noteClientIndices = [
    1, 8, 15, 22, 30, 37, 44, 51, 58, 65,
    2, 9, 16, 23, 31, 38, 45, 52, 59, 66,
    3, 10, 17, 24, 32, 39, 46, 53, 60, 67,
  ]

  for (let n = 0; n < 30; n++) {
    const clientIdx = noteClientIndices[n]
    const clientId = `client-bulk-${pad(clientIdx)}`
    const noteType = noteTypes[n % noteTypes.length]
    const author = ALL_USER_IDS[n % ALL_USER_IDS.length]

    const note: ClientNote = {
      id: `bulk-note-${pad(n + 1)}`,
      accountId: ACCOUNT_ID,
      clientId,
      createdByUserId: author,
      createdAt: noteCreatedDates[n],
      type: noteType,
      pinned: n % 15 === 0,
      body: noteBodies[n],
    }
    notes.push(note)
  }

  return { clients, policies, renewals, tasks, notes }
}
