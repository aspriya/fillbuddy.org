/* Field name → display label mapping */
const FIELD_NAME_MAP: Record<string, string> = {
  'Check Box1': 'SMS Alerts',
  '5% DD': 'Settlement 5%',
  Group7: 'Printed Statement',
  Group9: 'Employment Status',
  'Group 14': 'Auto Settle Bills',
  Group16: 'Balance Transfer',
  ChoiceGroup: 'Card Network',
  Group2: 'Title',
  Group5: 'Gender',
  Group6: 'Marital Status',
  Group10SUP: 'Title (Supplementary)',
  Group11: 'Gender (Supplementary)',
  Group12: 'Supplementary Limit',
  Group13: 'Payment Date',
};

export function cleanFieldName(name: string): string {
  if (FIELD_NAME_MAP[name]) return FIELD_NAME_MAP[name];
  let cleaned = name
    .replace(/[_]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\d+$/, '')
    .trim();
  if (!cleaned) return name;
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

/* Radio button display labels */
const RADIO_DISPLAY: Record<string, Record<string, string>> = {
  ChoiceGroup: { '3': 'LankaPay', '0': 'Mastercard', '1': 'VISA', '2': 'UnionPay' },
  Group2: { '0': 'Mr.', '1': 'Mrs.', '2': 'Miss.', '3': 'Dr.' },
  Group5: { '0': 'Male', '1': 'Female' },
  Group6: { '0': 'Married', '1': 'Single' },
};

export function getRadioLabel(fieldName: string, buttonValue: string): string {
  if (RADIO_DISPLAY[fieldName]?.[buttonValue])
    return RADIO_DISPLAY[fieldName][buttonValue];
  const v = String(buttonValue);
  return v
    .charAt(0)
    .toUpperCase()
    + v.slice(1).toLowerCase().replace(/selfemp/i, 'Self-employed');
}

/* Section grouping */
interface Section {
  key: string;
  label: string;
  matcher: (name: string) => boolean;
}

const SECTIONS: Section[] = [
  { key: 'choice', label: 'Card Type', matcher: (n) => /^ChoiceGroup$/i.test(n) },
  { key: 'personal', label: 'Personal Information', matcher: (n) => /name.*nic|^NIC$|^Passport$|^DOB$|^Nationality$|maiden|Group[256]|qualif|^Name|^Edu|^Mother|^PC Info/i.test(n) },
  { key: 'residence', label: 'Residence Details', matcher: (n) => /home.*address [123]$|mailing|^Phone No( |$)|Phone.*Home$|Phone.*Mobile$|^E-mail|^Years$|^Months$|Check Box1|Group7/i.test(n) },
  { key: 'relative', label: 'Relative Details', matcher: (n) => /relative|Relationship1|Phone No HomeMobile/i.test(n) },
  { key: 'employment', label: 'Employment', matcher: (n) => /employer|business|Designation1|salary|profit|^Office |service|nature|previous|self.*employ|turnover|capital|Group9|Phone No Office/i.test(n) },
  { key: 'spouse', label: 'Spouse Details', matcher: (n) => /spouse|annual.*income|Designation2|Name Of Buss/i.test(n) },
  { key: 'supp', label: 'Supplementary Card', matcher: (n) => /Group10|Group11|Group12|NAMEONCARD|full.*nic.*_2|NIC 2|PASSPORT2|Nationality_2|Relationship2|Mothers|home.*address_2|Phone.*Home_3|Phone.*Mobile_2|DOB2|^Others$|Others Specify_3/i.test(n) },
  { key: 'delivery', label: 'Card Delivery & Payment', matcher: (n) => /deliver|settlement|Group 14|5%|Group13/i.test(n) },
  { key: 'transfer', label: 'Balance Transfer', matcher: (n) => /transfer|other.*bank|account.*name|Group16|DOB3|^Amount|credit.*card.*number/i.test(n) },
  { key: 'decl', label: 'Declaration', matcher: (n) => /^IWe$|cardholder|^Date/i.test(n) },
  { key: 'bank', label: 'For Bank Use Only', matcher: (n) => /Emp No|Department|Lien|Audit|Officer|Recommend|Declined|^Rs$|Branch Mgr/i.test(n) },
];

export function getSection(fieldName: string): { key: string; label: string } {
  for (const s of SECTIONS) {
    if (s.matcher(fieldName)) return { key: s.key, label: s.label };
  }
  return { key: 'other', label: 'Other Fields' };
}
