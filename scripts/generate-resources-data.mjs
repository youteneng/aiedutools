import fs from 'node:fs/promises';
import path from 'node:path';

const PROJECT_ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const OUTPUT = path.join(PROJECT_ROOT, 'data', 'resources-data.json');
const REPO = 'TapXWorld/ChinaTextbook';
const DIRECT_ZIP_URL = 'https://codeload.github.com/TapXWorld/ChinaTextbook/zip/refs/heads/master';

const STAGES = [
  { key: 'elementary', label: '小学' },
  { key: 'secondary', label: '初中' },
  { key: 'highschool', label: '高中' },
];

const TYPES = [
  { key: 'textbook', label: '教材', query: '教材', format: 'PDF' },
  { key: 'curriculum-standard', label: '课程标准', query: '课程标准', format: 'PDF/网页' },
  { key: 'question-bank', label: '题库', query: '题库 习题', format: 'PDF/Docx' },
  { key: 'worksheet', label: '练习单', query: '练习单 作业单', format: 'Docx/PDF' },
  { key: 'mock-paper', label: '试卷', query: '试卷 真题', format: 'PDF' },
];

const SUBJECTS = [
  { key: 'chinese', label: '语文', stages: ['elementary', 'secondary', 'highschool'] },
  { key: 'math', label: '数学', stages: ['elementary', 'secondary', 'highschool'] },
  { key: 'english', label: '英语', stages: ['elementary', 'secondary', 'highschool'] },
  { key: 'science', label: '科学', stages: ['elementary'] },
  { key: 'physics', label: '物理', stages: ['secondary', 'highschool'] },
  { key: 'chemistry', label: '化学', stages: ['secondary', 'highschool'] },
  { key: 'biology', label: '生物', stages: ['secondary', 'highschool'] },
  { key: 'history', label: '历史', stages: ['secondary', 'highschool'] },
  { key: 'geography', label: '地理', stages: ['secondary', 'highschool'] },
  { key: 'politics', label: '政治', stages: ['secondary', 'highschool'] },
  { key: 'it', label: '信息技术', stages: ['elementary', 'secondary', 'highschool'] },
  { key: 'music', label: '音乐', stages: ['elementary', 'secondary', 'highschool'] },
  { key: 'art', label: '美术', stages: ['elementary', 'secondary', 'highschool'] },
  { key: 'pe', label: '体育', stages: ['elementary', 'secondary', 'highschool'] },
];

function buildDescription(stageLabel, subjectLabel, typeLabel) {
  if (typeLabel === '教材') return `${stageLabel}${subjectLabel}教材索引入口，便于备课与课堂实施。`;
  if (typeLabel === '课程标准') return `${stageLabel}${subjectLabel}课程标准索引入口，用于教学目标与评价对齐。`;
  if (typeLabel === '题库') return `${stageLabel}${subjectLabel}题库与习题索引入口，适用于分层训练与阶段测评。`;
  if (typeLabel === '练习单') return `${stageLabel}${subjectLabel}练习单索引入口，可用于随堂练与课后巩固。`;
  return `${stageLabel}${subjectLabel}试卷与真题索引入口，支持阶段复习与检测。`;
}

function buildSourceUrl(query) {
  return `https://github.com/TapXWorld/ChinaTextbook/search?q=${encodeURIComponent(query)}&type=code`;
}

async function run() {
  const today = new Date().toISOString().slice(0, 10);
  const resources = [];

  for (const stage of STAGES) {
    for (const subject of SUBJECTS) {
      if (!subject.stages.includes(stage.key)) continue;
      for (const type of TYPES) {
        const query = `${stage.label} ${subject.label} ${type.query}`;
        resources.push({
          id: `${stage.key}-${subject.key}-${type.key}`,
          title: `${stage.label}${subject.label}${type.label}`,
          stage: stage.key,
          subject: subject.key,
          type: type.key,
          format: type.format,
          source: 'GitHub · ChinaTextbook',
          description: buildDescription(stage.label, subject.label, type.label),
          sourceUrl: buildSourceUrl(query),
          downloadUrl: DIRECT_ZIP_URL,
          repo: REPO,
          updatedAt: today,
        });
      }
    }
  }

  const output = {
    updatedAt: today,
    sourceNotice: '资源为公开索引入口，文件版权归原权利方所有；请遵循原始来源的使用条款。',
    stats: {
      total: resources.length,
      stages: STAGES.length,
      subjects: SUBJECTS.length,
      types: TYPES.length,
    },
    resources,
  };

  await fs.writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`generated: ${OUTPUT}`);
  console.log(`resources: ${resources.length}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
