const SUPABASE_URL = "https://gkzoaftudhjhejtnssxs.supabase.co";
const SUPABASE_KEY = "sb_publishable_qMOWYLXw0K5lteDfGSnYFQ_qXjw-6Tj";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ======================================
// حفظ أو تحديث محاولة الطالب
// ======================================

async function saveStudentAttemptToSupabase(payload) {
  try {
    const rowData = {
      student_id: payload.studentId,
      question_id: payload.questionId ?? null,
      lesson: payload.lesson ?? "",
      lesson_key: payload.lessonKey ?? "",
      question: payload.question ?? "",
      written_answer: payload.writtenAnswer ?? "",
      solution_photo: payload.solutionPhoto ?? null,
      hint_used: Number(payload.hintUsed) || 0,
      hint_sequence: payload.hintSequence ?? [],
      ai_chat: payload.aiChat ?? [],
      ai_evaluation: payload.aiEvaluation ?? {},
      is_solved: Boolean(payload.isSolved),
      score: payload.score ?? null,
      submitted_at: new Date().toISOString()
    };

    let result;

    if (payload.attemptId !== null &&
        payload.attemptId !== undefined) {

      result = await supabaseClient
        .from("attempts")
        .update(rowData)
        .eq("id", payload.attemptId)
        .select()
        .single();

    } else {

      result = await supabaseClient
        .from("attempts")
        .insert([rowData])
        .select()
        .single();
    }

    if (result.error) throw result.error;

    return {
      data: result.data,
      error: null
    };

  } catch (error) {
    console.error("Saving student attempt failed:", error);

    return {
      data: null,
      error
    };
  }
}

// ======================================
// مساعد الذكاء الاصطناعي
// ======================================

async function callMathMindAI({
  roleLabel,
  systemPrompt,
  userPrompt,
  contextData = null
}) {
  try {
    // الاتصال بخادم آمن عبر Supabase Edge Function
    const { data, error } = await supabaseClient.functions.invoke(
      "teacher-ai",
      {
        body: {
          roleLabel,
          systemPrompt,
          userPrompt,
          contextData
        }
      }
    );

    if (error) throw error;

    if (data?.response) {
      return data.response;
    }

    throw new Error("لم يصل رد من خدمة الذكاء الاصطناعي");

  } catch (error) {
    console.error("AI service error:", error);

    // تحليل احتياطي من البيانات المتاحة
    if (contextData?.studentName) {
      const attempts = Array.isArray(contextData.attempts)
        ? contextData.attempts
        : [];

      const hintsCount = attempts.reduce(
        (sum, attempt) =>
          sum + (Number(attempt.hint_used) || 0),
        0
      );

      const chatCount = attempts.reduce(
        (sum, attempt) =>
          sum + (Array.isArray(attempt.ai_chat)
            ? attempt.ai_chat.length
            : 0),
        0
      );

      return (
        `تحليل بيانات الطالب: ${contextData.studentName}\n` +
        `عدد المحاولات: ${attempts.length}\n` +
        `إجمالي التلميحات المستخدمة: ${hintsCount}\n` +
        `عدد رسائل المحادثة: ${chatCount}\n\n` +
        `تعذر الاتصال بمساعد الذكاء الاصطناعي. ` +
        `هذه إحصاءات مسجلة وليست خطة علاجية مولدة.`
      );
    }

    return "تعذر الاتصال بمساعد الذكاء الاصطناعي. يرجى المحاولة لاحقًا.";
  }
}

// ======================================
// إرسال الواجبات والامتحانات
// ======================================

async function sendAssignmentToStudentPortal(assignmentPayload) {
  try {
    const record = {
      title: assignmentPayload.title,
      section: assignmentPayload.section,
      assignment_type: assignmentPayload.type || "واجب",
      instructions: assignmentPayload.instructions || "",
      file_name: assignmentPayload.fileName || null,
      file_data_url: assignmentPayload.fileDataUrl || null,
      created_at: new Date().toISOString()
    };

    const { data, error } = await supabaseClient
      .from("assignments")
      .insert([record])
      .select()
      .single();

    if (error) throw error;

    return {
      data,
      error: null
    };

  } catch (error) {
    console.error("Sending assignment failed:", error);

    return {
      data: null,
      error
    };
  }
}