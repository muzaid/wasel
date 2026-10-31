"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "ar" | "en" | "he";

const en = {
  app: "Wasel", tagline: "Your shipment, delivered by the nearest courier", hero_sub: "Post a shipment, the nearest couriers get it instantly, the first to accept picks it up — and your customer tracks it live.",
  for_business: "I'm a business", for_courier: "I'm a courier", login: "Log in", signup: "Sign up", logout: "Log out",
  email: "Email", password: "Password", full_name: "Full name", phone: "Phone", business_name: "Business name",
  no_account: "No account?", have_account: "Already have an account?", role: "Account type", business: "Business", courier: "Courier", admin: "Admin",
  vehicle: "Vehicle", bike: "Bicycle", motorcycle: "Motorcycle", car: "Car", van: "Van", plate: "Plate number", vehicle_model: "Model", vehicle_color: "Color",
  f1: "Nearest-courier dispatch", f1d: "We alert the X closest online couriers and widen the radius automatically.",
  f2: "Live tracking link", f2d: "Your customer gets a link with the courier's live location, car and ETA.",
  f3: "Fixed upfront price", f3d: "Price is calculated before you post. No haggling.",
  f4: "Delivery code & proof", f4d: "Recipient shares a 4-digit code; courier uploads a photo.",
  f5: "Cash on delivery", f5d: "Courier collects COD and it's tracked in the ledger.",
  f6: "Ratings & verification", f6d: "Every courier is verified by admin and rated after each trip.",
  dashboard: "Dashboard", new_shipment: "New shipment", shipments: "Shipments", history: "History", earnings: "Earnings", profile: "Profile",
  notifications: "Notifications", no_notifications: "No notifications", settings: "Settings", couriers: "Couriers", users: "Users", finance: "Finance",
  pickup: "Pickup", dropoff: "Drop-off", address: "Address", search_address: "Search address…", tap_map: "Tap the map to set the pin", use_my_location: "My location",
  contact_name: "Contact name", recipient: "Recipient", recipient_name: "Recipient name", recipient_phone: "Recipient phone",
  package: "Package", size: "Size", small: "Small", medium: "Medium", large: "Large", xlarge: "X-Large", size_hint_small: "Envelope / small box", size_hint_medium: "Shoe box", size_hint_large: "Big box", size_hint_xlarge: "Furniture / bulk",
  description: "Description", weight: "Weight (kg)", fragile: "Fragile", cod: "Cash on delivery (₪)", notes: "Notes for courier", schedule: "Schedule for later",
  required_vehicle: "Minimum vehicle", distance: "Distance", price: "Price", platform_fee: "Platform fee", courier_gets: "Courier gets", total: "Total",
  post_shipment: "Find a courier", posting: "Posting…", km: "km", min: "min",
  st_searching: "Searching for courier", st_accepted: "Courier on the way to pickup", st_arrived_pickup: "Courier at pickup", st_picked_up: "Picked up",
  st_in_transit: "On the way", st_delivered: "Delivered", st_cancelled: "Cancelled", st_expired: "No courier found",
  searching_title: "Finding the nearest courier…", notified: "couriers notified", radius: "Radius", round: "Round",
  share_tracking: "Share tracking link", copy: "Copy", copied: "Copied!", whatsapp: "WhatsApp", sms: "SMS",
  cancel: "Cancel", cancel_shipment: "Cancel shipment", cancel_reason: "Reason for cancelling", confirm: "Confirm",
  courier_details: "Courier", rating: "Rating", deliveries: "deliveries", call: "Call", eta: "ETA",
  timeline: "Timeline", rate_courier: "Rate the courier", submit: "Submit", thanks: "Thank you!",
  active: "Active", all: "All", today: "Today", week: "This week", total_spent: "Total spent", delivered_count: "Delivered", avg_time: "Avg. delivery",
  empty_shipments: "No shipments yet", create_first: "Create your first shipment",
  go_online: "Go online", go_offline: "Go offline", you_are_online: "You're online — waiting for jobs", you_are_offline: "You're offline",
  pending_verification: "Your account is awaiting admin verification. Upload your documents in Profile.", rejected_verification: "Your verification was rejected. Contact support.",
  new_offer: "New delivery request!", accept: "Accept", decline: "Decline", away: "away", earn: "You earn",
  already_taken: "Another courier already took this job", busy: "Finish your current job first",
  active_job: "Current job", navigate: "Navigate", arrived_pickup: "I've arrived at pickup", picked_up: "Package picked up", start_trip: "Start delivery", deliver: "Complete delivery",
  enter_otp: "Ask the recipient for the 4-digit delivery code", bad_otp: "Wrong delivery code", proof_photo: "Proof photo (optional)",
  collect_cash: "Collect cash", call_business: "Call sender", call_recipient: "Call recipient",
  balance: "Balance", fees_owed: "Platform fees", cod_held: "Cash on hand (COD)", payouts: "Payouts", net: "Net",
  documents: "Documents", id_doc: "ID card", license_doc: "Driving license", avatar: "Photo", upload: "Upload", save: "Save", saved: "Saved",
  verification: "Verification", approve: "Approve", reject: "Reject", block: "Block", unblock: "Unblock", pending: "Pending", approved: "Approved", rejected: "Rejected",
  revenue: "Admin revenue", revenue_today: "Revenue today", gmv: "Gross delivery value", online_now: "Online now", accept_time: "Avg. accept time",
  pricing: "Pricing", base_fare: "Base fare", per_km: "Per km", min_fare: "Minimum fare", fragile_fee: "Fragile fee", cod_fee: "COD fee",
  dispatch: "Dispatch", dispatch_count: "Couriers notified per round (X)", initial_radius: "Initial radius (km)", radius_step: "Radius step (km)", max_radius: "Max radius (km)", offer_timeout: "Offer timeout (sec)",
  platform_fee_hint: "Charged per delivered shipment (e.g. 1–2 ₪)", size_mult: "Size multipliers", vehicle_mult: "Vehicle multipliers",
  track_title: "Track your delivery", from: "From", to: "To", your_code: "Your delivery code", give_code: "Give this code to the courier on delivery",
  not_found: "Shipment not found", live: "LIVE", last_update: "Updated", powered_by: "Delivered with Wasel",
  configure_supabase: "Supabase is not configured. Copy .env.example to .env.local and add your keys.",
  error: "Something went wrong", loading: "Loading…", back: "Back", view: "View", details: "Details", code: "Code", date: "Date", status: "Status", amount: "Amount",
  settle_cod: "Settle COD", record_payout: "Record payout", search: "Search…", language: "Language",
  saved_addresses: "Saved addresses", save_address: "Save this address", label: "Label",
  sound_on: "Enable alerts", how_it_works: "How it works", h1: "Post", h1d: "Enter pickup, drop-off and package. Price shows instantly.", h2: "Match", h2d: "Nearest couriers get it; first to accept wins.", h3: "Track", h3d: "You and your customer follow the courier live.",
  start_now: "Start now", become_courier: "Drive with Wasel", stats_label: "Platform", per_shipment: "per shipment",
  your_photo: "Your photo", photo_hint: "A clear face photo — customers see it when you deliver", business_logo: "Business logo", logo_hint: "Shown to couriers and on your customers' tracking page", change_photo: "Change", add_logo_nudge: "Add your business logo so customers recognise your deliveries", sender: "Sender",
};

type Dict = typeof en;

const ar: Dict = {
  app: "واصل", tagline: "شحنتك توصل مع أقرب مندوب", hero_sub: "انشر شحنتك، أقرب المناديب بيوصلهم الطلب فوراً، أول واحد بيقبل بيستلم — وزبونك بيتابع الشحنة مباشرة.",
  for_business: "أنا صاحب مصلحة", for_courier: "أنا مندوب توصيل", login: "تسجيل الدخول", signup: "إنشاء حساب", logout: "تسجيل الخروج",
  email: "البريد الإلكتروني", password: "كلمة المرور", full_name: "الاسم الكامل", phone: "رقم الجوال", business_name: "اسم المصلحة",
  no_account: "ما عندك حساب؟", have_account: "عندك حساب؟", role: "نوع الحساب", business: "مصلحة تجارية", courier: "مندوب", admin: "مدير",
  vehicle: "المركبة", bike: "دراجة هوائية", motorcycle: "دراجة نارية", car: "سيارة", van: "فان", plate: "رقم اللوحة", vehicle_model: "الموديل", vehicle_color: "اللون",
  f1: "إرسال لأقرب مندوب", f1d: "بنبلّغ أقرب X مناديب متصلين وبنوسّع النطاق تلقائياً.",
  f2: "رابط تتبع مباشر", f2d: "زبونك بيوصله رابط فيه موقع المندوب، المركبة ووقت الوصول.",
  f3: "سعر ثابت مسبقاً", f3d: "السعر بينحسب قبل النشر. بدون مفاصلة.",
  f4: "رمز تسليم وإثبات", f4d: "المستلم بيعطي رمز من 4 أرقام والمندوب بيرفع صورة.",
  f5: "الدفع عند الاستلام", f5d: "المندوب بيحصّل المبلغ وبيتسجل بالحسابات.",
  f6: "تقييم وتوثيق", f6d: "كل مندوب موثّق من الإدارة وبينقيّم بعد كل توصيلة.",
  dashboard: "الرئيسية", new_shipment: "شحنة جديدة", shipments: "الشحنات", history: "السجل", earnings: "الأرباح", profile: "الملف الشخصي",
  notifications: "الإشعارات", no_notifications: "لا يوجد إشعارات", settings: "الإعدادات", couriers: "المناديب", users: "المستخدمين", finance: "المالية",
  pickup: "الاستلام", dropoff: "التسليم", address: "العنوان", search_address: "ابحث عن عنوان…", tap_map: "اضغط على الخريطة لتحديد الموقع", use_my_location: "موقعي",
  contact_name: "اسم المسؤول", recipient: "المستلم", recipient_name: "اسم المستلم", recipient_phone: "جوال المستلم",
  package: "الطرد", size: "الحجم", small: "صغير", medium: "متوسط", large: "كبير", xlarge: "كبير جداً", size_hint_small: "ظرف / علبة صغيرة", size_hint_medium: "علبة حذاء", size_hint_large: "كرتونة كبيرة", size_hint_xlarge: "أثاث / كميات",
  description: "الوصف", weight: "الوزن (كغ)", fragile: "قابل للكسر", cod: "الدفع عند الاستلام (₪)", notes: "ملاحظات للمندوب", schedule: "جدولة لوقت لاحق",
  required_vehicle: "أقل مركبة مطلوبة", distance: "المسافة", price: "السعر", platform_fee: "عمولة المنصة", courier_gets: "حصة المندوب", total: "المجموع",
  post_shipment: "ابحث عن مندوب", posting: "جاري النشر…", km: "كم", min: "دقيقة",
  st_searching: "جاري البحث عن مندوب", st_accepted: "المندوب بالطريق للاستلام", st_arrived_pickup: "المندوب وصل للاستلام", st_picked_up: "تم الاستلام",
  st_in_transit: "بالطريق إليك", st_delivered: "تم التسليم", st_cancelled: "ملغاة", st_expired: "لم يتم إيجاد مندوب",
  searching_title: "جاري البحث عن أقرب مندوب…", notified: "مناديب تم تبليغهم", radius: "النطاق", round: "الجولة",
  share_tracking: "شارك رابط التتبع", copy: "نسخ", copied: "تم النسخ!", whatsapp: "واتساب", sms: "رسالة",
  cancel: "إلغاء", cancel_shipment: "إلغاء الشحنة", cancel_reason: "سبب الإلغاء", confirm: "تأكيد",
  courier_details: "المندوب", rating: "التقييم", deliveries: "توصيلة", call: "اتصال", eta: "الوصول خلال",
  timeline: "مراحل الشحنة", rate_courier: "قيّم المندوب", submit: "إرسال", thanks: "شكراً لك!",
  active: "نشطة", all: "الكل", today: "اليوم", week: "هذا الأسبوع", total_spent: "إجمالي المصروف", delivered_count: "تم تسليمها", avg_time: "متوسط التوصيل",
  empty_shipments: "لا يوجد شحنات بعد", create_first: "أنشئ أول شحنة",
  go_online: "ابدأ الاستقبال", go_offline: "إيقاف الاستقبال", you_are_online: "أنت متصل — بانتظار الطلبات", you_are_offline: "أنت غير متصل",
  pending_verification: "حسابك بانتظار توثيق الإدارة. ارفع وثائقك من الملف الشخصي.", rejected_verification: "تم رفض التوثيق. تواصل مع الدعم.",
  new_offer: "طلب توصيل جديد!", accept: "قبول", decline: "رفض", away: "بعيد", earn: "ربحك",
  already_taken: "مندوب آخر أخذ الطلب", busy: "أنهِ الطلب الحالي أولاً",
  active_job: "الطلب الحالي", navigate: "الملاحة", arrived_pickup: "وصلت لنقطة الاستلام", picked_up: "استلمت الطرد", start_trip: "ابدأ التوصيل", deliver: "إتمام التسليم",
  enter_otp: "اطلب من المستلم رمز التسليم المكوّن من 4 أرقام", bad_otp: "رمز التسليم خاطئ", proof_photo: "صورة إثبات (اختياري)",
  collect_cash: "حصّل نقداً", call_business: "اتصل بالمرسل", call_recipient: "اتصل بالمستلم",
  balance: "الرصيد", fees_owed: "عمولات المنصة", cod_held: "نقد معك (عند الاستلام)", payouts: "الدفعات", net: "الصافي",
  documents: "الوثائق", id_doc: "الهوية", license_doc: "رخصة القيادة", avatar: "الصورة", upload: "رفع", save: "حفظ", saved: "تم الحفظ",
  verification: "التوثيق", approve: "قبول", reject: "رفض", block: "حظر", unblock: "إلغاء الحظر", pending: "قيد المراجعة", approved: "موثّق", rejected: "مرفوض",
  revenue: "أرباح الإدارة", revenue_today: "أرباح اليوم", gmv: "إجمالي قيمة التوصيل", online_now: "متصلين الآن", accept_time: "متوسط وقت القبول",
  pricing: "التسعير", base_fare: "الأجرة الأساسية", per_km: "لكل كم", min_fare: "أقل أجرة", fragile_fee: "رسوم قابل للكسر", cod_fee: "رسوم الدفع عند الاستلام",
  dispatch: "التوزيع", dispatch_count: "عدد المناديب بكل جولة (X)", initial_radius: "النطاق الأولي (كم)", radius_step: "زيادة النطاق (كم)", max_radius: "أقصى نطاق (كم)", offer_timeout: "مهلة العرض (ثانية)",
  platform_fee_hint: "تُحسب على كل شحنة مُسلّمة (مثلاً 1–2 ₪)", size_mult: "معاملات الحجم", vehicle_mult: "معاملات المركبة",
  track_title: "تتبع شحنتك", from: "من", to: "إلى", your_code: "رمز التسليم", give_code: "أعطِ هذا الرمز للمندوب عند الاستلام",
  not_found: "الشحنة غير موجودة", live: "مباشر", last_update: "آخر تحديث", powered_by: "التوصيل عبر واصل",
  configure_supabase: "Supabase غير مُعد. انسخ ‎.env.example إلى ‎.env.local وأضف المفاتيح.",
  error: "صار خطأ", loading: "جاري التحميل…", back: "رجوع", view: "عرض", details: "التفاصيل", code: "الرمز", date: "التاريخ", status: "الحالة", amount: "المبلغ",
  settle_cod: "تسوية النقد", record_payout: "تسجيل دفعة", search: "بحث…", language: "اللغة",
  saved_addresses: "العناوين المحفوظة", save_address: "احفظ العنوان", label: "التسمية",
  sound_on: "تفعيل التنبيهات", how_it_works: "كيف بيشتغل", h1: "انشر", h1d: "أدخل الاستلام والتسليم والطرد. السعر بيظهر فوراً.", h2: "مطابقة", h2d: "أقرب المناديب بيوصلهم الطلب؛ أول واحد بيقبل بياخده.", h3: "تتبع", h3d: "إنت وزبونك بتتابعوا المندوب مباشرة.",
  start_now: "ابدأ الآن", become_courier: "اشتغل مندوب مع واصل", stats_label: "المنصة", per_shipment: "لكل شحنة",
  your_photo: "صورتك الشخصية", photo_hint: "صورة واضحة للوجه — بتظهر للزبون وقت التوصيل", business_logo: "شعار المصلحة", logo_hint: "بيظهر للمناديب وبصفحة تتبع زبائنك", change_photo: "تغيير", add_logo_nudge: "أضف شعار مصلحتك عشان زبائنك يعرفوا شحناتك", sender: "المرسل",
};

const he: Dict = {
  app: "ואסל", tagline: "המשלוח שלך, עם השליח הקרוב ביותר", hero_sub: "פרסמו משלוח, השליחים הקרובים מקבלים אותו מיד, הראשון שמאשר אוסף — והלקוח עוקב בזמן אמת.",
  for_business: "אני עסק", for_courier: "אני שליח", login: "התחברות", signup: "הרשמה", logout: "התנתקות",
  email: "אימייל", password: "סיסמה", full_name: "שם מלא", phone: "טלפון", business_name: "שם העסק",
  no_account: "אין לך חשבון?", have_account: "יש לך חשבון?", role: "סוג חשבון", business: "עסק", courier: "שליח", admin: "מנהל",
  vehicle: "רכב", bike: "אופניים", motorcycle: "אופנוע", car: "רכב פרטי", van: "מסחרית", plate: "מספר רישוי", vehicle_model: "דגם", vehicle_color: "צבע",
  f1: "שיגור לשליח הקרוב", f1d: "מתריעים ל-X השליחים הקרובים ומרחיבים את הרדיוס אוטומטית.",
  f2: "קישור מעקב חי", f2d: "הלקוח מקבל קישור עם מיקום השליח, הרכב וזמן הגעה.",
  f3: "מחיר קבוע מראש", f3d: "המחיר מחושב לפני הפרסום. בלי מיקוח.",
  f4: "קוד מסירה והוכחה", f4d: "הנמען מוסר קוד בן 4 ספרות; השליח מעלה תמונה.",
  f5: "תשלום במזומן במסירה", f5d: "השליח גובה והסכום נרשם בספר החשבונות.",
  f6: "דירוג ואימות", f6d: "כל שליח מאומת ע\"י מנהל ומדורג אחרי כל משלוח.",
  dashboard: "ראשי", new_shipment: "משלוח חדש", shipments: "משלוחים", history: "היסטוריה", earnings: "הכנסות", profile: "פרופיל",
  notifications: "התראות", no_notifications: "אין התראות", settings: "הגדרות", couriers: "שליחים", users: "משתמשים", finance: "כספים",
  pickup: "איסוף", dropoff: "מסירה", address: "כתובת", search_address: "חיפוש כתובת…", tap_map: "הקישו על המפה לקביעת מיקום", use_my_location: "המיקום שלי",
  contact_name: "איש קשר", recipient: "נמען", recipient_name: "שם הנמען", recipient_phone: "טלפון הנמען",
  package: "חבילה", size: "גודל", small: "קטן", medium: "בינוני", large: "גדול", xlarge: "גדול מאוד", size_hint_small: "מעטפה / קופסה קטנה", size_hint_medium: "קופסת נעליים", size_hint_large: "קרטון גדול", size_hint_xlarge: "רהיטים / כמויות",
  description: "תיאור", weight: "משקל (ק\"ג)", fragile: "שביר", cod: "גבייה במסירה (₪)", notes: "הערות לשליח", schedule: "תזמון למועד מאוחר",
  required_vehicle: "רכב מינימלי", distance: "מרחק", price: "מחיר", platform_fee: "עמלת פלטפורמה", courier_gets: "השליח מקבל", total: "סה\"כ",
  post_shipment: "מצא שליח", posting: "מפרסם…", km: "ק\"מ", min: "דק'",
  st_searching: "מחפש שליח", st_accepted: "השליח בדרך לאיסוף", st_arrived_pickup: "השליח בנקודת האיסוף", st_picked_up: "נאסף",
  st_in_transit: "בדרך", st_delivered: "נמסר", st_cancelled: "בוטל", st_expired: "לא נמצא שליח",
  searching_title: "מחפשים את השליח הקרוב…", notified: "שליחים קיבלו התראה", radius: "רדיוס", round: "סבב",
  share_tracking: "שתף קישור מעקב", copy: "העתק", copied: "הועתק!", whatsapp: "וואטסאפ", sms: "SMS",
  cancel: "ביטול", cancel_shipment: "בטל משלוח", cancel_reason: "סיבת ביטול", confirm: "אישור",
  courier_details: "השליח", rating: "דירוג", deliveries: "משלוחים", call: "חייג", eta: "זמן הגעה",
  timeline: "ציר זמן", rate_courier: "דרגו את השליח", submit: "שלח", thanks: "תודה!",
  active: "פעילים", all: "הכל", today: "היום", week: "השבוע", total_spent: "סה\"כ הוצאות", delivered_count: "נמסרו", avg_time: "זמן מסירה ממוצע",
  empty_shipments: "אין משלוחים עדיין", create_first: "צרו את המשלוח הראשון",
  go_online: "התחל לקבל", go_offline: "הפסק לקבל", you_are_online: "מחובר — ממתין לעבודות", you_are_offline: "לא מחובר",
  pending_verification: "החשבון ממתין לאימות מנהל. העלו מסמכים בפרופיל.", rejected_verification: "האימות נדחה. פנו לתמיכה.",
  new_offer: "בקשת משלוח חדשה!", accept: "קבל", decline: "דחה", away: "מרחק", earn: "תרוויח",
  already_taken: "שליח אחר כבר לקח את העבודה", busy: "סיימו קודם את העבודה הנוכחית",
  active_job: "עבודה נוכחית", navigate: "ניווט", arrived_pickup: "הגעתי לאיסוף", picked_up: "החבילה נאספה", start_trip: "התחל מסירה", deliver: "סיים מסירה",
  enter_otp: "בקשו מהנמען את קוד המסירה בן 4 הספרות", bad_otp: "קוד מסירה שגוי", proof_photo: "תמונת הוכחה (רשות)",
  collect_cash: "גבה מזומן", call_business: "חייג לשולח", call_recipient: "חייג לנמען",
  balance: "יתרה", fees_owed: "עמלות פלטפורמה", cod_held: "מזומן בידך", payouts: "תשלומים", net: "נטו",
  documents: "מסמכים", id_doc: "תעודת זהות", license_doc: "רישיון נהיגה", avatar: "תמונה", upload: "העלאה", save: "שמור", saved: "נשמר",
  verification: "אימות", approve: "אשר", reject: "דחה", block: "חסום", unblock: "בטל חסימה", pending: "ממתין", approved: "מאומת", rejected: "נדחה",
  revenue: "הכנסות מנהל", revenue_today: "הכנסות היום", gmv: "ערך משלוחים כולל", online_now: "מחוברים עכשיו", accept_time: "זמן קבלה ממוצע",
  pricing: "תמחור", base_fare: "מחיר בסיס", per_km: "לכל ק\"מ", min_fare: "מחיר מינימום", fragile_fee: "תוספת שביר", cod_fee: "תוספת גבייה",
  dispatch: "שיגור", dispatch_count: "שליחים בכל סבב (X)", initial_radius: "רדיוס התחלתי (ק\"מ)", radius_step: "הגדלת רדיוס (ק\"מ)", max_radius: "רדיוס מקסימלי (ק\"מ)", offer_timeout: "זמן הצעה (שניות)",
  platform_fee_hint: "נגבה על כל משלוח שנמסר (למשל 1–2 ₪)", size_mult: "מכפילי גודל", vehicle_mult: "מכפילי רכב",
  track_title: "מעקב משלוח", from: "מ", to: "אל", your_code: "קוד המסירה שלך", give_code: "מסרו קוד זה לשליח בעת המסירה",
  not_found: "המשלוח לא נמצא", live: "חי", last_update: "עודכן", powered_by: "נמסר עם ואסל",
  configure_supabase: "Supabase לא מוגדר. העתיקו ‎.env.example ל-‎.env.local והוסיפו מפתחות.",
  error: "משהו השתבש", loading: "טוען…", back: "חזרה", view: "צפה", details: "פרטים", code: "קוד", date: "תאריך", status: "סטטוס", amount: "סכום",
  settle_cod: "סגירת מזומן", record_payout: "רישום תשלום", search: "חיפוש…", language: "שפה",
  saved_addresses: "כתובות שמורות", save_address: "שמור כתובת", label: "תווית",
  sound_on: "הפעל התראות", how_it_works: "איך זה עובד", h1: "פרסם", h1d: "הזינו איסוף, מסירה וחבילה. המחיר מופיע מיד.", h2: "התאמה", h2d: "השליחים הקרובים מקבלים; הראשון שמאשר לוקח.", h3: "מעקב", h3d: "אתם והלקוח עוקבים אחרי השליח בזמן אמת.",
  start_now: "התחילו עכשיו", become_courier: "הצטרפו כשליחים", stats_label: "פלטפורמה", per_shipment: "למשלוח",
  your_photo: "התמונה שלך", photo_hint: "תמונת פנים ברורה — הלקוח רואה אותה במסירה", business_logo: "לוגו העסק", logo_hint: "מוצג לשליחים ובדף המעקב של הלקוחות", change_photo: "החלף", add_logo_nudge: "הוסיפו את לוגו העסק כדי שהלקוחות יזהו את המשלוחים", sender: "שולח",
};

const dicts: Record<Lang, Dict> = { ar, en, he };
export type TKey = keyof Dict;

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: TKey) => string; dir: "rtl" | "ltr" }>({
  lang: "ar", setLang: () => {}, t: (k) => ar[k], dir: "rtl",
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("ar");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("wasel_lang") as Lang | null;
      if (saved && dicts[saved]) setLangState(saved);
    } catch {}
  }, []);
  const dir = lang === "en" ? "ltr" : "rtl";
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
  }, [lang, dir]);
  const setLang = (l: Lang) => {
    setLangState(l);
    try { localStorage.setItem("wasel_lang", l); } catch {}
  };
  const t = (k: TKey) => dicts[lang][k] ?? en[k] ?? k;
  return <Ctx.Provider value={{ lang, setLang, t, dir }}>{children}</Ctx.Provider>;
}

export const useI18n = () => useContext(Ctx);
