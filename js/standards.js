(function () {
  const standards = {
    chinese_support: ["强", "中", "弱"],
    access_type: ["国内可直连", "需注册", "需特殊网络"],
    pricing_type: ["免费", "免费增值", "付费"],
    source_type: ["官方信息", "编辑整理", "社区实测"],
    review_status: ["pending", "approved", "rejected"],
    target_users: ["师范生", "实习教师", "新教师", "一线教师", "教研员", "高校教师"],
    usage_scenarios: ["教案", "PPT课件", "说课稿", "教学反思", "论文写作", "作业批改", "出题测验", "班会设计", "教育实习", "教研活动"],
    education_stages: ["小学", "初中", "高中", "大学", "职教"],
    subjects: ["语文", "数学", "英语", "物理", "化学", "生物", "道法/政治", "历史", "地理", "信息技术", "综合通用"]
  };

  function normalizeEnum(value, enumName, fallback) {
    const enums = standards[enumName] || [];
    if (enums.includes(value)) return value;
    return fallback !== undefined ? fallback : (enums[0] || "");
  }

  window.ShihangStandards = {
    ...standards,
    normalizeEnum
  };
})();
