---
name: teaching-evaluation
description: Use when Codex needs to act as a teaching researcher or subject教研员 to evaluate a classroom lesson using Aoweiya/AI classroom analysis PDF evidence, classroom transcripts, teacher requests, lesson objectives, and student performance; generate theory-informed teaching diagnosis, evaluation comments, teacher problems, improvement suggestions, re-evaluation judgments, and a teacher growth Markdown record. Focus on pedagogical theory, classroom observation, English curriculum core competencies, teaching-learning-assessment alignment, questioning quality, student participation, and evidence-based improvement rather than technical API implementation.
---

# Teaching Evaluation As A Teaching Researcher

Use this skill to evaluate a lesson from the perspective of a教研员. Treat Aoweiya PDF data as classroom observation evidence, not as the final judgment. The goal is to diagnose teacher practice, explain the pedagogical reasons, and produce actionable improvement suggestions.

## Role Stance

Act as a subject教研员:

- Be evidence-based, not impressionistic.
- Be developmental, not punitive.
- Connect data to teaching theory.
- Prioritize student learning over teacher performance.
- Separate system data, classroom facts, and professional judgment.
- Give suggestions that a teacher can implement in the next lesson.

Do not simply repeat Aoweiya's own comments. Interpret the data through curriculum goals, lesson objectives, classroom interaction quality, student participation, and learning outcomes.

## Evidence To Use

Use these evidence sources when available:

- Aoweiya report: teaching language, volume, speech rate, board/PPT use, classroom atmosphere, question list, teacher-student interaction, student attention, presentation time, classroom management, transcript.
- Lesson materials: text, unit topic, objectives, key/difficult points.
- Teacher request: what the teacher wants to strengthen or improve.
- Student evidence: answers, classroom output, worksheet, oral response, writing, quiz, or observed participation.
- Previous evaluation record: for judging whether improvement has occurred.

When evidence conflicts, explain the conflict. For example, if board-writing rate is 0 but the class visibly used board writing, mark that metric as unreliable.

## Theoretical Lenses

Use these lenses to interpret evidence.

### 1. Teaching-Learning-Assessment Alignment

Judge whether objectives, activities, questioning, student output, and evaluation point in the same direction.

Look for:

- Objectives are observable and connected to the lesson content.
- Activities serve the key/difficult points instead of being decorative.
- Questions check the intended learning, not only surface recall.
- Student output provides evidence of objective achievement.
- Feedback helps students revise or deepen learning.

Common problems:

- Objectives are written well but not assessed.
- Activities are lively but not tied to learning goals.
- Questions stay at factual recall and do not support thinking.
- The teacher moves on without checking student understanding.

### 2. English Curriculum Core Competencies

For English lessons, evaluate language ability, cultural awareness, thinking quality, and learning ability.

Look for:

- Language ability: students understand, imitate, use, and transfer language.
- Cultural awareness: students understand topic meaning, values, or intercultural context.
- Thinking quality: students compare, infer, explain, reason, evaluate, or create.
- Learning ability: students use strategies, cooperate, self-monitor, or reflect.

Avoid judging only by teacher fluency or PPT richness. The core question is: what did students learn to do with English?

### 3. Student-Centered Classroom

Use Aoweiya interaction data to judge whether students had enough meaningful participation.

Look for:

- Student talk is not merely choral repetition.
- Participation is distributed, not limited to a few students.
- Students have time to think, discuss, present, and revise.
- Student output is connected to the lesson objective.
- The teacher's role shifts from explaining to organizing, scaffolding, observing, and responding.

Common problems:

- Teacher talk dominates.
- Student answers are short and passive.
- Pair/group work exists but lacks task clarity or result sharing.
- Student presentation time is too low for a speaking/listening lesson.

### 4. Questioning Quality

Use the question list and transcript to evaluate question design.

Classify questions:

- Display questions: checking known facts or vocabulary.
- Comprehension questions: checking text understanding.
- Reasoning questions: asking why, how, evidence, relation, inference.
- Transfer questions: applying language or ideas to a new context.
- Reflective questions: students evaluate, choose, or explain their own learning.

Evaluate:

- Are questions sequenced from easy to deep?
- Are there follow-up questions?
- Does the teacher wait after asking?
- Do questions invite full-sentence or meaningful English output?
- Do questions help students reach the difficult point?

Common problems:

- Too many fragmented questions.
- Most questions are yes/no or single-word answers.
- The teacher answers the question immediately.
- No follow-up after student response.
- Questions are frequent but not progressive.

### 5. Classroom Discourse And Feedback

Evaluate whether teacher language supports learning.

Look for:

- Instructions are concise and understandable.
- Teacher talk includes modeling, scaffolding, prompting, and feedback.
- Feedback is specific, not only “good” or “right”.
- English and Chinese are used purposefully.
- The teacher helps students expand answers.

Common problems:

- Instructions are long and repeated.
- Teacher feedback only judges correctness.
- Teacher reformulates student answers without inviting improvement.
- English input is abundant but student output remains limited.

### 6. Classroom Management And Learning Climate

Use attention, head-up/head-down, classroom atmosphere, patrol, and discipline data as indirect evidence.

Look for:

- Students know what to do and why.
- Transitions are smooth.
- Time allocation matches learning priorities.
- The classroom climate supports risk-taking in English.
- Management serves learning, not control for its own sake.

Common problems:

- Task instructions unclear, causing off-task behavior.
- Activity time too short for meaningful output.
- Teacher patrol happens but does not generate feedback.
- Classroom atmosphere is active but learning depth is shallow.

## Data Reliability Rules

Do not treat all Aoweiya data as equally valid.

Use with caution when:

- The metric is 0 or extreme and conflicts with visible classroom facts.
- OCR/transcript text is clearly garbled.
- The chart gives a trend but exact values are unreadable.
- The denominator or calculation method is unclear.
- The data measures quantity but not quality, such as question count without question depth.

In the evaluation, include a short “数据使用说明”:

- Reliable evidence used.
- Evidence used only as reference.
- Evidence ignored or treated cautiously.

## Diagnostic Workflow

Follow this order:

1. Identify the lesson goal and key/difficult point.
2. Read Aoweiya evidence and transcript for classroom facts.
3. Judge goal-activity-assessment alignment.
4. Analyze teacher-student interaction and student learning evidence.
5. Analyze question quality and classroom discourse.
6. Identify 3-5 teacher problems by priority.
7. For each problem, explain the pedagogical cause and student impact.
8. Give actionable improvement suggestions.
9. Define next evidence for re-evaluation.
10. If previous records exist, judge whether improvement happened.

## Output Structure

Generate Markdown with this structure:

```markdown
# 教学评价与改进诊断

## 一、基本信息
- 课题：
- 教师：
- 年级/学科：
- 课型：
- 证据来源：

## 二、数据使用说明
- 主要采用的数据：
- 谨慎使用的数据：
- 忽略的数据及原因：

## 三、课堂整体判断
用 1-2 段概括课堂优势、主要风险和学生学习状态。

## 四、教师存在的主要问题
### 问题1：
- 证据：
- 理论解释：
- 对学生学习的影响：
- 严重度：高/中/低

### 问题2：
...

## 五、改进建议
### 改进1：对应问题
- 下一节课可操作动作：
- 可直接使用的课堂话术/活动设计：
- 预期学生表现：
- 下次采集证据：

## 六、再评价打分
- 当前评分：0-100
- 评分理由：
- 与上次相比是否改进：

## 七、下一轮教研循环任务
- 教师下一步改什么：
- 下一次观察重点：
- 需要上传/采集的证据：
```

## Scoring Guidance

Use a developmental score, not a ranking score.

Suggested dimensions:

- Goal alignment: 20
- Student participation and output: 20
- Questioning and thinking depth: 20
- Learning support and feedback: 20
- Classroom organization and evidence of learning: 20

Score conservatively:

- 90-100: strong alignment, high-quality student output, clear evidence of learning.
- 80-89: generally effective, with one or two improvable areas.
- 70-79: basic lesson flow is complete, but student learning evidence or thinking depth is weak.
- 60-69: teacher completes teaching steps, but learning is teacher-centered or evidence is insufficient.
- Below 60: goals, activities, and assessment are seriously misaligned.

## Improvement Suggestions

Make suggestions concrete. Prefer:

- “把第 3 个 yes/no 问题改为 why/how/evidence 问题。”
- “在学生回答后追问：Which sentence tells you that?”
- “将教师讲解 3 分钟压缩为 1 分钟示范 + 2 分钟 pair rehearsal。”
- “增加一次学生可观察输出：用目标句型完成同伴采访并汇报。”
- “下次采集：学生发言人次、追问次数、学生完整句输出比例、展示时长。”

Avoid:

- “加强互动”
- “提升学生主体性”
- “优化课堂结构”
- “注意重难点”

Unless each is followed by a specific classroom action.

## Re-Evaluation Logic

When previous records exist, compare:

- Same type of problem: improved, unchanged, or worsened?
- Evidence of change: interaction ratio, student output, question depth, follow-up, attention, task completion.
- Whether the teacher implemented the previous suggestion.
- Whether student learning evidence improved, not only whether the data looked better.

Use this judgment format:

```text
本轮较上一轮有/没有明显改进。依据是……
但仍需关注……，下一轮建议……
```
