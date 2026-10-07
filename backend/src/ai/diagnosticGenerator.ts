import { generateStructuredAIResponse } from "./aiClient.js";
import { AIDiagnosticQuestionsResponseJsonSchema, AIDiagnosticQuestionsResponseSchema } from "../validators/schemas.js";
import { ZodError } from "zod";
import { Question, IQuestion } from "../models/Question.js";
import { Course } from "../models/Course.js";

export async function generateDiagnosticQuestions(params: {
  subjectId: string;
  courseId?: string;
  selectedTopicId?: string;
}) {
  const { subjectId, courseId, selectedTopicId } = params;

  // Course structure and reusable questions are independent reads.
  const [course, existingQuestions] = await Promise.all([
    courseId ? Course.findOne({ id: courseId }) : Promise.resolve(null),
    courseId ? Question.find({ courseId, type: "diagnostic" }) : Promise.resolve([]),
  ]);

  const allTopics = course?.topics?.length
    ? course.topics.map((t) => ({ id: t.id, name: t.name, description: t.description }))
    : [
        { id: `${subjectId}_topic_1`, name: "Foundations", description: "Core fundamental principles" },
        { id: `${subjectId}_topic_2`, name: "Core Architecture", description: "Architecture and design" },
        { id: `${subjectId}_topic_3`, name: "Implementation & Methods", description: "Key techniques" },
        { id: `${subjectId}_topic_4`, name: "Optimization & Safety", description: "Advanced concepts" },
      ];
  const topicsList = selectedTopicId ? allTopics.filter((topic) => topic.id === selectedTopicId) : allTopics;
  if (!topicsList.length) throw Object.assign(new Error("The selected topic does not belong to this course."), { status: 404, code: "TOPIC_NOT_FOUND" });

  const reusableQuestions = selectedTopicId
    ? existingQuestions.filter((question) => question.topicId === selectedTopicId)
    : existingQuestions;
  const requiredQuestionCount = selectedTopicId ? 5 : topicsList.length;
  if (reusableQuestions.length >= requiredQuestionCount) {
    console.log(`[Diagnostic] Reused ${requiredQuestionCount} saved diagnostic questions.`);
    return reusableQuestions.slice(0, requiredQuestionCount).map((q) => ({
      id: q.id,
      topicId: q.topicId,
      difficulty: q.difficulty,
      question: q.question,
      options: q.options,
    }));
  }

  const systemPrompt = `You are the lead diagnostic assessment designer for ADAPT, an adaptive AI learning companion.
Generate ${selectedTopicId ? "exactly 5" : "5 to 7"} high-quality diagnostic multiple-choice questions for the course topics provided.
Diagnostic requirements:
1. ${selectedTopicId ? "Generate five distinct questions that probe different concepts and difficulty levels within the selected topic." : "Generate 1 question for each topic in the topic list."}
2. Questions must accurately probe foundational understanding to distinguish beginner, intermediate, and advanced learners.
3. Every question must have exactly 4 plausible options labeled 'a', 'b', 'c', 'd'.
4. Indicate the single correct option ('a', 'b', 'c', or 'd').
5. Provide a concise, clear explanation.
6. Provide 'conceptTested'.
7. Output JSON strictly matching:
{
  "questions": [
    {
      "topicName": "Process Management",
      "difficulty": "easy",
      "question": "Which structure stores information about a process in an operating system?",
      "options": [
        { "id": "a", "text": "PCB (Process Control Block)" },
        { "id": "b", "text": "Page Table" },
        { "id": "c", "text": "CPU Cache" },
        { "id": "d", "text": "File Descriptor" }
      ],
      "correctOptionId": "a",
      "explanation": "The Process Control Block (PCB) stores critical information about process state.",
      "conceptTested": "Process management fundamentals"
    }
  ]
}`;

  const userPrompt = `Course Subject: "${course?.title || subjectId}".
Curriculum Topics:
${topicsList.map((t, idx) => `${idx + 1}. Topic ID: "${t.id}", Name: "${t.name}" (${t.description})`).join("\n")}

Please create diagnostic questions tailored specifically to these topics.`;

  const diagnosticSchema = selectedTopicId
    ? { ...AIDiagnosticQuestionsResponseJsonSchema, properties: { ...(AIDiagnosticQuestionsResponseJsonSchema as any).properties, questions: { type: "ARRAY", minItems: 5, maxItems: 5, items: (AIDiagnosticQuestionsResponseJsonSchema as any).properties.questions.items } } }
    : AIDiagnosticQuestionsResponseJsonSchema;
  const aiData = await generateStructuredAIResponse(
    systemPrompt,
    userPrompt,
    (raw) => {
      const parsed = AIDiagnosticQuestionsResponseSchema.parse(raw);
      const matchedNames = parsed.questions.map((question) => question.topicName?.toLowerCase()).filter(Boolean);
      const expectedNames = new Set(topicsList.map((topic) => topic.name.toLowerCase()));
      const hasFullCoverage = selectedTopicId
        ? parsed.questions.length === 5 && matchedNames.length === 5 && matchedNames.every((name) => expectedNames.has(name!))
        : expectedNames.size === parsed.questions.length && matchedNames.length === parsed.questions.length &&
          new Set(matchedNames).size === expectedNames.size && matchedNames.every((name) => expectedNames.has(name!));
      if (!hasFullCoverage) {
        throw new ZodError([{ code: "custom", path: ["questions"], message: "Return exactly one question for each curriculum topic." }]);
      }
      return parsed;
    },
    diagnosticSchema
  );

  const generatedQuestions: IQuestion[] = [];
  const clientSafeQuestions: Array<{ id: string; topicId: string; difficulty: string; question: string; options: unknown }> = [];
  const generationTimestamp = Date.now();

  for (let i = 0; i < aiData.questions.length; i++) {
    const item = aiData.questions[i];
    // Map to corresponding topicId
    const matchingTopic = topicsList.find((t) => t.name.toLowerCase() === item.topicName?.toLowerCase());
    if (!matchingTopic) {
      throw new Error("Validated diagnostic question did not match a curriculum topic.");
    }

    const qId = `q_${courseId || subjectId}_${generationTimestamp}_${selectedTopicId || "course"}_${i + 1}`;

    const questionDoc = new Question({
      id: qId,
      courseId: courseId || null,
      subjectId,
      topicId: matchingTopic.id,
      difficulty: item.difficulty,
      question: item.question,
      options: item.options,
      correctOptionId: item.correctOptionId,
      explanation: item.explanation,
      conceptTested: item.conceptTested,
      type: "diagnostic",
      estimatedTimeSeconds: 30,
    });

    generatedQuestions.push(questionDoc);

    // Client-safe version without correctOptionId
    clientSafeQuestions.push({
      id: qId,
      topicId: matchingTopic.id,
      difficulty: item.difficulty,
      question: item.question,
      options: item.options,
    });
  }

  if (generatedQuestions.length) await Question.insertMany(generatedQuestions);
  console.log(`[Diagnostic] Generated and saved ${generatedQuestions.length} diagnostic questions.`);

  // If a specific topic was selected, prioritize questions for that topic first
  if (selectedTopicId) {
    clientSafeQuestions.sort(
      (a, b) => Number(b.topicId === selectedTopicId) - Number(a.topicId === selectedTopicId)
    );
  }

  return clientSafeQuestions;
}
