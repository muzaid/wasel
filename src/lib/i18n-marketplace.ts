"use client";
/**
 * Translations for the marketplace features (Phase 1+): customers, multi-role accounts,
 * business teams and B2C / C2C / B2B deliveries. Kept as its own namespace so features
 * can grow without touching the core dictionary.
 */
import { useI18n } from "./i18n";

const en = {
  customer: "Customer", customers: "Customers", users: "Users",
  role_customer: "Personal", role_courier: "Courier", role_business: "Business", role_admin: "Admin",
  switch_account: "Switch account",
  send_package: "Send a package", send_package_hint: "Documents, gifts, personal items — picked up and delivered by the nearest courier.",
  signup_customer_hint: "Send personal packages", signup_business_hint: "Deliveries for my shop or company", signup_courier_hint: "Earn by delivering",
  my_deliveries: "My deliveries", recent: "Recent", no_deliveries: "You haven't sent anything yet",
  your_roles: "Your accounts", become_courier: "Become a courier", become_courier_hint: "Use the same login to deliver and earn.",
  create_business: "Create a business", create_business_hint: "Send deliveries for your shop, add employees and track spending.",
  open: "Open", create: "Create", business_category: "Category", registration_number: "Registration number", business_email: "Business email",
  cat_restaurant: "Restaurant", cat_retail: "Shop / retail", cat_pharmacy: "Pharmacy", cat_ecommerce: "Online shop", cat_warehouse: "Warehouse / supplier", cat_other: "Other",
  team: "Team", add_member: "Add employee", member_email: "Employee email", member_hint: "The employee must first sign up to Wasel with this email.",
  m_owner: "Owner", m_manager: "Manager", m_dispatcher: "Dispatcher", remove: "Remove", user_not_found: "No Wasel account with this email",
  recipient_type: "Deliver to", to_person: "A person", to_business: "A business (B2B)", search_business: "Search businesses on Wasel…", no_business_found: "No business found",
  incoming: "Incoming deliveries", incoming_hint: "Deliveries other businesses are sending to you",
  type_b2c: "B2C", type_c2c: "C2C", type_b2b: "B2B",
  type_b2c_long: "Business → Customer", type_c2c_long: "Person → Person", type_b2b_long: "Business → Business",
  sender_individual: "Individual", sender_business: "Business",
  three_ways: "One platform, every kind of delivery",
  b2c_desc: "Restaurants, shops and pharmacies deliver to their customers.",
  c2c_desc: "Anyone can send documents, gifts or belongings to anyone.",
  b2b_desc: "Stock between shops, warehouses, suppliers and branches.",
  verification_status: "Verification", business_invite: "You were added to a business team",
  incoming_picked_up: "Incoming delivery picked up", incoming_delivered: "Incoming delivery arrived",
};
type Dict = typeof en;

const ar: Dict = {
  customer: "زبون", customers: "الزبائن", users: "المستخدمين",
  role_customer: "شخصي", role_courier: "مندوب", role_business: "مصلحة", role_admin: "مدير",
  switch_account: "تبديل الحساب",
  send_package: "أرسل طرد", send_package_hint: "أوراق، هدايا، أغراض شخصية — أقرب مندوب بيستلمها وبيوصلها.",
  signup_customer_hint: "إرسال طرود شخصية", signup_business_hint: "توصيل لمحلي أو شركتي", signup_courier_hint: "اربح من التوصيل",
  my_deliveries: "طلباتي", recent: "الأحدث", no_deliveries: "لسا ما أرسلت إشي",
  your_roles: "حساباتك", become_courier: "اشتغل مندوب", become_courier_hint: "بنفس تسجيل الدخول بتقدر توصّل وتربح.",
  create_business: "أنشئ مصلحة", create_business_hint: "أرسل طلبات لمحلك، أضف موظفين وتابع المصاريف.",
  open: "فتح", create: "إنشاء", business_category: "التصنيف", registration_number: "رقم التسجيل", business_email: "بريد المصلحة",
  cat_restaurant: "مطعم", cat_retail: "محل تجاري", cat_pharmacy: "صيدلية", cat_ecommerce: "متجر إلكتروني", cat_warehouse: "مستودع / مورّد", cat_other: "أخرى",
  team: "الفريق", add_member: "إضافة موظف", member_email: "بريد الموظف", member_hint: "لازم الموظف يسجّل بواصل أولاً بنفس البريد.",
  m_owner: "المالك", m_manager: "مدير", m_dispatcher: "موزّع طلبات", remove: "إزالة", user_not_found: "ما في حساب واصل بهذا البريد",
  recipient_type: "التوصيل إلى", to_person: "شخص", to_business: "مصلحة (B2B)", search_business: "ابحث عن مصلحة على واصل…", no_business_found: "ما في نتائج",
  incoming: "طلبات واردة", incoming_hint: "شحنات بترسلها مصالح ثانية إلك",
  type_b2c: "B2C", type_c2c: "C2C", type_b2b: "B2B",
  type_b2c_long: "مصلحة ← زبون", type_c2c_long: "شخص ← شخص", type_b2b_long: "مصلحة ← مصلحة",
  sender_individual: "فرد", sender_business: "مصلحة",
  three_ways: "منصة وحدة لكل أنواع التوصيل",
  b2c_desc: "مطاعم ومحلات وصيدليات بتوصّل لزبائنها.",
  c2c_desc: "أي حدا بيقدر يبعث أوراق أو هدايا أو أغراض لأي حدا.",
  b2b_desc: "بضاعة بين المحلات والمستودعات والموردين والفروع.",
  verification_status: "التوثيق", business_invite: "تمت إضافتك لفريق مصلحة",
  incoming_picked_up: "تم استلام شحنة واردة", incoming_delivered: "وصلت شحنة واردة",
};

const he: Dict = {
  customer: "לקוח", customers: "לקוחות", users: "משתמשים",
  role_customer: "אישי", role_courier: "שליח", role_business: "עסק", role_admin: "מנהל",
  switch_account: "החלפת חשבון",
  send_package: "שלח חבילה", send_package_hint: "מסמכים, מתנות, חפצים אישיים — השליח הקרוב אוסף ומוסר.",
  signup_customer_hint: "משלוחים אישיים", signup_business_hint: "משלוחים לעסק שלי", signup_courier_hint: "להרוויח ממשלוחים",
  my_deliveries: "המשלוחים שלי", recent: "אחרונים", no_deliveries: "עדיין לא שלחת כלום",
  your_roles: "החשבונות שלך", become_courier: "הצטרף כשליח", become_courier_hint: "עם אותה התחברות אפשר גם למסור ולהרוויח.",
  create_business: "צור עסק", create_business_hint: "שלח משלוחים לעסק, הוסף עובדים ועקוב אחרי ההוצאות.",
  open: "פתח", create: "צור", business_category: "קטגוריה", registration_number: "מספר רישום", business_email: "אימייל העסק",
  cat_restaurant: "מסעדה", cat_retail: "חנות", cat_pharmacy: "בית מרקחת", cat_ecommerce: "חנות אונליין", cat_warehouse: "מחסן / ספק", cat_other: "אחר",
  team: "צוות", add_member: "הוסף עובד", member_email: "אימייל העובד", member_hint: "העובד צריך להירשם קודם לוואסל עם האימייל הזה.",
  m_owner: "בעלים", m_manager: "מנהל", m_dispatcher: "מוקדן", remove: "הסר", user_not_found: "אין חשבון וואסל עם האימייל הזה",
  recipient_type: "משלוח אל", to_person: "אדם", to_business: "עסק (B2B)", search_business: "חיפוש עסקים בוואסל…", no_business_found: "לא נמצא עסק",
  incoming: "משלוחים נכנסים", incoming_hint: "משלוחים שעסקים אחרים שולחים אליך",
  type_b2c: "B2C", type_c2c: "C2C", type_b2b: "B2B",
  type_b2c_long: "עסק ← לקוח", type_c2c_long: "אדם ← אדם", type_b2b_long: "עסק ← עסק",
  sender_individual: "פרטי", sender_business: "עסק",
  three_ways: "פלטפורמה אחת לכל סוגי המשלוחים",
  b2c_desc: "מסעדות, חנויות ובתי מרקחת שולחים ללקוחות.",
  c2c_desc: "כל אחד יכול לשלוח מסמכים, מתנות או חפצים לכל אחד.",
  b2b_desc: "סחורה בין חנויות, מחסנים, ספקים וסניפים.",
  verification_status: "אימות", business_invite: "צורפת לצוות של עסק",
  incoming_picked_up: "משלוח נכנס נאסף", incoming_delivered: "משלוח נכנס הגיע",
};

const dicts = { en, ar, he };
export type MKey = keyof Dict;

/** Marketplace translations: `const { tm } = useTm(); tm("send_package")` */
export function useTm() {
  const { lang } = useI18n();
  return { tm: (k: MKey) => dicts[lang][k] ?? en[k] ?? k };
}
