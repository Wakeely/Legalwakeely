import type {
  Analysis,
  Document,
  LawyerProfile,
  Lead,
  User,
} from "./types";

export const mockUsers: User[] = [
  {
    id: "u1",
    phone: "+962791234567",
    email: "sami@example.jo",
    name: "سامي العلي",
    role: "CITIZEN",
    language: "ar",
    createdAt: "2026-04-12T10:24:00Z",
  },
  {
    id: "u2",
    phone: "+962795551122",
    name: "ليلى حسن",
    role: "CITIZEN",
    language: "ar",
    createdAt: "2026-05-02T14:11:00Z",
  },
  {
    id: "u3",
    phone: "+962790000001",
    name: "أحمد المحامي",
    role: "LAWYER",
    language: "ar",
    createdAt: "2026-03-20T09:00:00Z",
  },
  {
    id: "u4",
    phone: "+962790000000",
    name: "Admin",
    role: "ADMIN",
    language: "ar",
    createdAt: "2026-01-15T08:00:00Z",
  },
];

export const mockLawyers: LawyerProfile[] = [
  {
    id: "l1",
    userId: "u3",
    name: "أحمد الرواشدة",
    avatar: "https://i.pravatar.cc/200?img=12",
    specialties: ["labor", "rental"],
    cities: ["Amman", "Zarqa"],
    hourlyRate: 60,
    bio: {
      ar: "محامٍ أردني مرخص بخبرة 12 عاماً في قضايا العمل والإيجار. قدمت استشارات قانونية لأكثر من 800 عميل.",
      en: "Licensed Jordanian lawyer with 12 years of experience in labor and rental disputes. Advised 800+ clients.",
    },
    verified: true,
    rating: 4.9,
    totalReviews: 142,
    barNumber: "JO-2009-4421",
    isAvailable: true,
    languages: ["ar", "en"],
    yearsExperience: 12,
    successStories: 312,
  },
  {
    id: "l2",
    userId: "u5",
    name: "دانا الخالدي",
    avatar: "https://i.pravatar.cc/200?img=47",
    specialties: ["family", "consumer"],
    cities: ["Amman"],
    hourlyRate: 75,
    bio: {
      ar: "محامية متخصصة في قضايا الأسرة وحماية المستهلك. أتعامل مع كل قضية بحساسية ومهنية عالية.",
      en: "Lawyer specializing in family law and consumer protection. Every case handled with sensitivity and rigor.",
    },
    verified: true,
    rating: 4.8,
    totalReviews: 98,
    barNumber: "JO-2014-7788",
    isAvailable: true,
    languages: ["ar", "en"],
    yearsExperience: 8,
    successStories: 198,
  },
  {
    id: "l3",
    userId: "u6",
    name: "خالد الطراونة",
    avatar: "https://i.pravatar.cc/200?img=33",
    specialties: ["criminal", "traffic"],
    cities: ["Amman", "Irbid"],
    hourlyRate: 90,
    bio: {
      ar: "محامٍ بخبرة 15 عاماً في القضايا الجنائية والمخالفات المرورية. معروف بنسبة نجاح عالية في القضايا المعقدة.",
      en: "Lawyer with 15 years in criminal and traffic cases. Known for high success rate in complex matters.",
    },
    verified: true,
    rating: 4.7,
    totalReviews: 211,
    barNumber: "JO-2008-1199",
    isAvailable: false,
    languages: ["ar"],
    yearsExperience: 15,
    successStories: 421,
  },
  {
    id: "l4",
    userId: "u7",
    name: "رنا الزعبي",
    avatar: "https://i.pravatar.cc/200?img=49",
    specialties: ["commercial", "rental"],
    cities: ["Amman", "Aqaba"],
    hourlyRate: 110,
    bio: {
      ar: "مستشار قانوني للشركات والعقود التجارية، مع تركيز خاص على عقود الإيجار التجاري.",
      en: "Legal counsel for corporates and commercial contracts, with a focus on commercial leases.",
    },
    verified: true,
    rating: 4.9,
    totalReviews: 64,
    barNumber: "JO-2012-3322",
    isAvailable: true,
    languages: ["ar", "en"],
    yearsExperience: 10,
    successStories: 156,
  },
  {
    id: "l5",
    userId: "u8",
    name: "محمد بني عمر",
    avatar: "https://i.pravatar.cc/200?img=15",
    specialties: ["labor"],
    cities: ["Irbid", "Zarqa"],
    hourlyRate: 50,
    bio: {
      ar: "متخصص في نزاعات العمل وحقوق الموظفين. أقدم استشارات شفافة بأتعاب معقولة.",
      en: "Labor disputes and employee rights specialist. Transparent advice at fair fees.",
    },
    verified: false,
    rating: 4.5,
    totalReviews: 38,
    barNumber: "JO-2018-5511",
    isAvailable: true,
    languages: ["ar"],
    yearsExperience: 5,
    successStories: 72,
  },
  {
    id: "l6",
    userId: "u9",
    name: "سارة عبيدات",
    avatar: "https://i.pravatar.cc/200?img=44",
    specialties: ["family"],
    cities: ["Amman"],
    hourlyRate: 80,
    bio: {
      ar: "محامية أسرة، أتعامل مع قضايا الطلاق والحضانة والنفقة بسرية واحترام.",
      en: "Family lawyer handling divorce, custody, and alimony cases with discretion and respect.",
    },
    verified: true,
    rating: 4.8,
    totalReviews: 87,
    barNumber: "JO-2015-6622",
    isAvailable: true,
    languages: ["ar", "en"],
    yearsExperience: 9,
    successStories: 167,
  },
];

export const mockDocuments: Document[] = [
  {
    id: "d1",
    userId: "u1",
    title: "عقد إيجار شقة في عبدون",
    fileType: "pdf",
    documentType: "rental",
    status: "REVIEWED",
    contentExcerpt:
      "عقد إيجار شقة سكنية في منطقة عبدون بين المالك السيد خالد … والمستأجر السيد سامي … بمبلغ شهري 450 دينار لمدة سنة كاملة…",
    createdAt: "2026-06-01T11:20:00Z",
  },
  {
    id: "d2",
    userId: "u1",
    title: "إنذار فصل من العمل",
    fileType: "image",
    documentType: "employment",
    status: "REVIEWED",
    contentExcerpt:
      "بناءً على المادة 22 من قانون العمل الأردني، نُحيطكم علماً بقرار إنهاء خدماتكم من تاريخ …",
    createdAt: "2026-05-22T09:00:00Z",
  },
  {
    id: "d3",
    userId: "u1",
    title: "مخالفة مرورية - قطع إشارة",
    fileType: "image",
    documentType: "traffic",
    status: "REVIEWED",
    contentExcerpt:
      "مخالفة مرورية رقم … بتاريخ … بسبب قطع إشارة ضوئية حمراء … غرامة 150 دينار…",
    createdAt: "2026-05-10T15:45:00Z",
  },
];

export const mockAnalyses: Analysis[] = [
  {
    id: "a1",
    documentId: "d1",
    userId: "u1",
    documentType: "rental",
    documentTitle: "عقد إيجار شقة في عبدون",
    summary:
      "عقد إيجار سكني لمدة سنة، بقيمة شهرية 450 دينار أردني ورهن شهرين كضمان. يحتوي العقد على شروط عادية إلا أن بند الإخلاء المبكر قد يكون مُجحفاً بحق المستأجر، كما أن بند الصيانة غير متوازن.",
    rights: [
      "الحق باسترداد مبلغ الضمان كاملاً عند نهاية العقد وتسليم الشقة بحالتها الطبيعية (ما عدا الاستهلاك العادي).",
      "الحق بإخطار خطي قبل 90 يوماً من تاريخ تجديد العقد إن رغب المستأجر بعدم التجديد.",
      "الحق بالخصم من مبلغ الإيجار في حال تعطّل خدمات أساسية (مياه، كهرباء) لأكثر من 48 ساعة.",
      "الحق بفسخ العقد دون غرامة إذا تبيّن إخفاء المالك لعيوب جوهرية في الشقة.",
    ],
    obligations: [
      "دفع الإيجار في اليوم الأول من كل شهر بشكل مُسبَق.",
      "الامتناع عن إحداث تغييرات إنشائية في الشقة دون موافقة خطية من المالك.",
      "الحفاظ على الشقة بحالتها الطبيعية وعدم الإضرار بالممتلكات.",
      "إخطار المالك بأي عطل يحتاج صيانة خلال 48 ساعة من اكتشافه.",
    ],
    risks: [
      {
        text: "بند الإخلاء المبكر يفرض غرامة 3 أشهر إيجار كاملة، وهو أعلى من المعتاد (المتعارف عليه شهر إلى شهرين).",
        severity: "high",
      },
      {
        text: "بند الصيانة يُلزم المستأجر بكل الإصلاحات حتى الكبيرة (أكثر من 200 دينار)، وهو بند غير متوازن.",
        severity: "medium",
      },
      {
        text: "لا يوجد بند صريح يمنع المالك من قطع الخدمات أو تغيير الأقفال دون حكم قضائي.",
        severity: "medium",
      },
      {
        text: "بند يُلزِم بدفع فائدة تأخير 10% شهرياً على أي قسط متأخر، وهي نسبة مرتفعة.",
        severity: "low",
      },
    ],
    lawyerScore: "MEDIUM",
    lawyerReason:
      "العقد يحتوي على بعض البنود غير المتوازنة (الإخلاء المبكر والصيانة)، لكن لا يحتوي على بنود فاسخة بشكل قاطع. يمكن التفاوض مع المالك أو طلب تعديل البنود قبل التوقيع، وإن حدث نزاع لاحقاً يُفضَّل الاستعانة بمحامٍ.",
    nextSteps: [
      {
        title: "تفاوض على البند 6 (الإخلاء المبكر)",
        description:
          "اطلب من المالك تخفيض الغرامة من 3 أشهر إلى شهر واحد، وهو المعتاد في السوق الأردني.",
        isPaid: false,
      },
      {
        title: "إعداد ملحق كتابي للصيانة",
        description:
          "اتفق كتابياً على حد الصيانة التي يتحملها المستأجر (مثلاً: 100 دينار فقط).",
        isPaid: false,
      },
      {
        title: "استشارة محامٍ متخصص بالإيجار",
        description:
          "قبل التوقيع، يمكن لمحامٍ بـ 60 دينار/ساعة مراجعة العقد كاملاً مقابل 30-60 دقيقة.",
        isPaid: true,
      },
      {
        title: "حفظ نسخة موقّعة",
        description:
          "تأكد من استلام نسختين موقّعتين (واحدة لك) وإيداع نسخة لدى كاتب العدل إن كان العقد لأكثر من سنة.",
        isPaid: false,
      },
    ],
    sources: [
      {
        lawName: "قانون الإيجار الأردني",
        articleNumber: "المادة 14",
        excerpt:
          "لا يجوز للمالك أن يطلب إخلاء المأجور قبل انقضاء مدة العقد إلا في حالات محددة حصراً.",
      },
      {
        lawName: "القانون المدني الأردني",
        articleNumber: "المادة 169",
        excerpt: "يلتزم المتعاقد بتنفيذ ما اشتمل عليه العقد بحسن نية.",
      },
      {
        lawName: "قانون الإيجار الأردني",
        articleNumber: "المادة 23",
        excerpt:
          "تعود مسؤولية صيانة المأجور الجوهرية للمالك ما لم يتفق الطرفان على خلاف ذلك صراحةً.",
      },
    ],
    confidenceScore: 0.87,
    reviewStatus: "APPROVED",
    reviewedBy: "u4",
    reviewNotes: "Reviewed and approved by admin.",
    createdAt: "2026-06-01T11:24:00Z",
  },
  {
    id: "a2",
    documentId: "d2",
    userId: "u1",
    documentType: "employment",
    documentTitle: "إنذار فصل من العمل",
    summary:
      "إنذار كتابي بإنهاء خدمات الموظف وفقاً للمادة 22 من قانون العمل الأردني، مع الإشارة إلى أسباب تتعلق بالأداء. مدة الإشعار شهر واحد، ومكافأة نهاية الخدمة مُحتسبة حتى تاريخ الفصل.",
    rights: [
      "الحق بالطعن بقرار الفصل أمام محكمة العمل خلال 60 يوماً من استلام الإشعار.",
      "الحق بمكافأة نهاية الخدمة كاملة وفق المادة 32 من قانون العمل.",
      "الحق بالحصول على شهادة خدمة تذكر سبب إنهاء العقد فقط بموافقتك.",
      "الحق بإجازة سنوية لم تُستهلك وراتب الشهر الأخير كاملاً.",
    ],
    obligations: [
      "تسليم جميع ممتلكات العمل خلال 7 أيام من تاريخ آخر يوم عمل.",
      "الامتناع عن إفشاء أسرار العمل بعد إنهاء العقد.",
      "حضور جلسات التسوية الودية إن طُلبت من الوزارة.",
    ],
    risks: [
      {
        text: "الإنذار يشير إلى \"فقدان الثقة\" كسبب، وهي مادة مرنة قد يستغلها صاحب العمل لرفض التعويضات.",
        severity: "high",
      },
      {
        text: "مدة الإشعار شهر واحد فقط، بينما يحق لك بثلاثة أشهر إن كانت خدمتك أكثر من 5 سنوات.",
        severity: "high",
      },
      {
        text: "لا توجد في الإنذار إشارة إلى محاولة نقل الموظف لوظيفة أخرى، وهو شرط قانوني للفصل التأديبي.",
        severity: "medium",
      },
    ],
    lawyerScore: "HIGH",
    lawyerReason:
      "هناك مؤشرات قوية على فصل تعسفي (عدم كفاية مدة الإشعار، سبب مرن جداً، عدم عرض وظيفة بديلة). يُنصح بشدة باستشارة محامٍ متخصص بقانون العمل قبل توقيع أي وثيقة إنهاء.",
    nextSteps: [
      {
        title: "لا توقّع أي وثيقة إنهاء دون مراجعة محامٍ",
        description: "توقيع وثيقة إنهاء غالباً يعني تنازل عن حقك بالطعن.",
        isPaid: false,
      },
      {
        title: "احتفظ بنسخة من كل المراسلات",
        description: "حتى الرسائل النصية ورسائل البريد الإلكتروني مع الإدارة.",
        isPaid: false,
      },
      {
        title: "استشارة محامٍ عمل خلال 48 ساعة",
        description: "الطعن ممكن خلال 60 يوماً، لكن البدء مبكراً يقوّي موقفك.",
        isPaid: true,
      },
    ],
    sources: [
      {
        lawName: "قانون العمل الأردني",
        articleNumber: "المادة 22",
        excerpt:
          "لا يجوز لصاحب العمل فصل العامل إلا في حالات محددة، ويجب إخطاره قبل شهر على الأقل.",
      },
      {
        lawName: "قانون العمل الأردني",
        articleNumber: "المادة 32",
        excerpt: "تستحق مكافأة نهاية الخدمة بواقع أجر شهر عن كل سنة خدمة.",
      },
    ],
    confidenceScore: 0.91,
    reviewStatus: "APPROVED",
    reviewedBy: "u4",
    createdAt: "2026-05-22T09:04:00Z",
  },
  {
    id: "a3",
    documentId: "d3",
    userId: "u1",
    documentType: "traffic",
    documentTitle: "مخالفة مرورية - قطع إشارة",
    summary:
      "مخالفة مرورية بسبب قطع إشارة ضوئية حمراء، وقيمتها 150 دينار أردني. المخالفة قابلة للاعتراض خلال 30 يوماً من تاريخ التبليغ، ولا توجد نقاط سوداء مُسجَّلة على المخالفة.",
    rights: [
      "الحق بالاعتراض على المخالفة خلال 30 يوماً من تاريخ التبليغ.",
      "الحق بطلب صور وأدلة المخالفة قبل أي محاكمة.",
      "الحق بدفع 50% من قيمة المخالفة كتسوية ودية خلال 14 يوماً.",
    ],
    obligations: [
      "دفع الغرامة خلال 60 يوماً لتفادي تعليق رخصة القيادة.",
      "حضور جلسة الترافع في حال الاعتراض.",
    ],
    risks: [
      {
        text: "تكرار المخالفة خلال سنة قد يؤدي إلى مضاعفة الغرامة وسحب الرخصة مؤقتاً.",
        severity: "medium",
      },
    ],
    lawyerScore: "LOW",
    lawyerReason:
      "مخالفة واضحة بأدلة (الإشارة والصورة) وقيمتها منخفضة. يمكن تسويتها ودّياً أو الاعتراض عليها شخصياً بدون محامٍ.",
    nextSteps: [
      {
        title: "ادفع نصف المبلغ كتسوية ودية",
        description: "ادفع 75 دينار خلال 14 يوماً من تاريخ المخالفة لإنهائها.",
        isPaid: false,
      },
      {
        title: "اعترض إن كنت تعتقد أن الأدلة غير كافية",
        description: "تقدّم بقسم المرور بطلب اعتراض وأرفق ما يثبت موقعك أو قراءة الكاميرا الخاطئة.",
        isPaid: false,
      },
    ],
    sources: [
      {
        lawName: "قانون المرور الأردني",
        articleNumber: "المادة 39",
        excerpt: "يعاقب بغرامة لا تقل عن 100 دينار كل من قطع إشارة ضوئية حمراء.",
      },
    ],
    confidenceScore: 0.95,
    reviewStatus: "APPROVED",
    reviewedBy: "u4",
    createdAt: "2026-05-10T15:50:00Z",
  },
];

export const mockLeads: Lead[] = [
  {
    id: "ld1",
    userId: "u1",
    userName: "سامي العلي",
    analysisId: "a2",
    analysisSummary: "إنذار فصل من العمل — احتمال فصل تعسفي مرتفع.",
    lawyerId: "l1",
    documentType: "employment",
    status: "PENDING",
    message: "السلام عليكم، استلمت إنذار فصل وأحتاج استشارة عاجلة.",
    feeOffered: 50,
    createdAt: "2026-05-22T10:00:00Z",
  },
  {
    id: "ld2",
    userId: "u2",
    userName: "ليلى حسن",
    analysisId: "a1",
    analysisSummary: "عقد إيجار يحتوي بنوداً غير متوازنة.",
    lawyerId: "l1",
    documentType: "rental",
    status: "ACCEPTED",
    message: "أحتاج مراجعة بنود عقد إيجار قبل التوقيع.",
    feeOffered: 30,
    createdAt: "2026-06-01T13:30:00Z",
  },
  {
    id: "ld3",
    userId: "u1",
    userName: "سامي العلي",
    analysisId: "a1",
    analysisSummary: "مخالفة مرورية بسيطة.",
    lawyerId: "l3",
    documentType: "traffic",
    status: "REJECTED",
    message: "استشارة بسيطة لمخالفة مرورية.",
    createdAt: "2026-05-11T08:00:00Z",
  },
];

export const specialtyLabels: Record<string, { ar: string; en: string }> = {
  labor: { ar: "قانون العمل", en: "Labor" },
  rental: { ar: "قانون الإيجار", en: "Rental" },
  criminal: { ar: "قضايا جنائية", en: "Criminal" },
  family: { ar: "قانون الأسرة", en: "Family" },
  commercial: { ar: "قانون تجاري", en: "Commercial" },
  traffic: { ar: "المرور", en: "Traffic" },
  consumer: { ar: "حماية المستهلك", en: "Consumer" },
};

export const cityLabels: Record<string, { ar: string; en: string }> = {
  Amman: { ar: "عمّان", en: "Amman" },
  Zarqa: { ar: "الزرقاء", en: "Zarqa" },
  Irbid: { ar: "إربد", en: "Irbid" },
  Aqaba: { ar: "العقبة", en: "Aqaba" },
};
