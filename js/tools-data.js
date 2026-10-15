(function () {
  const cache = {
    tools: null
  };

  function normalizeValue(value) {
    return String(value || "").trim().toLowerCase();
  }

  async function fetchTools() {
    if (cache.tools) return cache.tools;
    const candidates = ["./data/processed/tools.json", "./data/tools.json"];
    for (const file of candidates) {
      try {
        const response = await fetch(file, { cache: "no-store" });
        if (!response.ok) continue;
        const tools = await response.json();
        cache.tools = Array.isArray(tools) ? tools : [];
        return cache.tools;
      } catch (error) {
        // 尝试下一个候选路径
      }
    }
    throw new Error("无法读取工具数据文件（data/processed/tools.json）");
  }

  function getToolBySlugOrId(tools, slug, id) {
    const targetSlug = normalizeValue(slug);
    const targetId = normalizeValue(id);
    return (
      tools.find((tool) => normalizeValue(tool.slug) === targetSlug) ||
      tools.find((tool) => normalizeValue(tool.id) === targetId) ||
      tools.find((tool) => tool.is_active) ||
      tools[0] ||
      null
    );
  }

  function pricingLabel(type) {
    if (type === "免费") return "免费可用";
    if (type === "免费增值") return "免费增值";
    if (type === "付费") return "付费";
    return type || "未知";
  }

  function chineseSupportLabel(level) {
    return `中文支持：${level || "未知"}`;
  }

  function accessTypeLabel(accessType) {
    if (accessType === "国内可直连") return "国内可直连";
    if (accessType === "需注册") return "需注册";
    if (accessType === "需特殊网络") return "需特殊网络";
    return accessType || "未知";
  }

  function escapeHTML(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  window.ShihangData = {
    fetchTools,
    getToolBySlugOrId,
    pricingLabel,
    chineseSupportLabel,
    accessTypeLabel,
    escapeHTML
  };
})();
