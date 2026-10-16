export const TOOL_TYPE_LABEL_MAP = {
  'lesson-planning': '备课助手',
  'ppt-generation': 'PPT生成',
  grading: '作业批改',
  'quiz-generation': '题库生成',
  'teaching-management': '教学管理',
};

export const STAGE_LABEL_MAP = {
  elementary: '小学教育',
  secondary: '中学教育',
  'higher-ed': '高等教育',
  'general-ai': '通用AI',
};

export const STAGE_SHORT_LABEL_MAP = {
  elementary: '小学',
  secondary: '中学',
  'higher-ed': '高等教育',
  'general-ai': '通用AI',
};

export function getToolTypeLabel(category) {
  return TOOL_TYPE_LABEL_MAP[category] || '教学管理';
}

export function getStageLabel(level) {
  return STAGE_LABEL_MAP[level] || '';
}

export function getStageShortLabel(level) {
  return STAGE_SHORT_LABEL_MAP[level] || '中学';
}

export function getStageLabels(levels) {
  const resolved = Array.isArray(levels) && levels.length > 0 ? levels : ['general-ai'];
  return resolved.map((lv) => STAGE_LABEL_MAP[lv]).filter(Boolean);
}
