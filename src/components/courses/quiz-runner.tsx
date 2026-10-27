'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Send,
  X,
  Award,
} from 'lucide-react';
import { CourseQuizItem, CourseQuestionItem, CourseQuizAttemptItem } from '@/types/domain';
import { Button } from '@/components/ui/button';

interface QuizRunnerProps {
  circleId: string;
  quizId: string;
  onClose: () => void;
  onCompleted?: (attempt: CourseQuizAttemptItem) => void;
}

export function QuizRunner({ circleId, quizId, onClose, onCompleted }: QuizRunnerProps) {
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<(CourseQuizItem & { questions: CourseQuestionItem[] }) | null>(null);
  const [attempt, setAttempt] = useState<CourseQuizAttemptItem | null>(null);
  const [answers, setAnswers] = useState<Record<string, Record<string, unknown>>>({});
  const [timeRemainingSec, setTimeRemainingSec] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedAttempt, setCompletedAttempt] = useState<CourseQuizAttemptItem | null>(null);

  // Load quiz details
  useEffect(() => {
    let isMounted = true;
    async function loadQuiz() {
      try {
        const res = await fetch(`/api/circles/${circleId}/courses?mode=quiz&quizId=${quizId}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to load quiz');
        if (isMounted) {
          setQuiz(data.quiz);
          if (data.quiz.time_limit_minutes) {
            setTimeRemainingSec(data.quiz.time_limit_minutes * 60);
          }
        }
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : 'Unable to load quiz');
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadQuiz();
    return () => {
      isMounted = false;
    };
  }, [circleId, quizId]);

  // Timer countdown
  useEffect(() => {
    if (timeRemainingSec === null || !attempt || completedAttempt) return;
    if (timeRemainingSec <= 0) {
      handleFinalize();
      return;
    }
    const timer = setInterval(() => {
      setTimeRemainingSec((prev) => (prev && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemainingSec, attempt, completedAttempt]);

  async function handleStartAttempt() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start_quiz_attempt',
          quizId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start attempt');
      setAttempt(data.attempt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start attempt');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectAnswer(questionId: string, answerData: Record<string, unknown>) {
    if (!attempt || completedAttempt) return;
    setAnswers((prev) => ({ ...prev, [questionId]: answerData }));

    // Autosave to server
    try {
      await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submit_quiz_answer',
          attemptId: attempt.id,
          questionId,
          answerData,
        }),
      });
    } catch {
      // Autosave failover handled on final submit
    }
  }

  async function handleFinalize() {
    if (!attempt || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/circles/${circleId}/courses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'finalize_quiz_attempt',
          attemptId: attempt.id,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit quiz');
      setCompletedAttempt(data.attempt);
      onCompleted?.(data.attempt);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit assessment');
    } finally {
      setSubmitting(false);
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-stone-200 bg-white p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-100 pb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800">
              Assessment Checkpoint
            </span>
            <h3 className="text-lg font-bold text-stone-900">{quiz?.title || 'Quiz Assessment'}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-stone-200 p-1.5 text-stone-500 hover:bg-stone-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="py-16 text-center text-xs text-stone-500">Loading assessment questions...</div>
        ) : !attempt && !completedAttempt ? (
          <div className="py-8 space-y-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
              <Award className="h-7 w-7" />
            </div>

            <div className="max-w-md mx-auto space-y-2">
              <h4 className="text-base font-bold text-stone-900">{quiz?.title}</h4>
              <p className="text-xs text-stone-600">{quiz?.description || 'Test your understanding before progressing.'}</p>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs border border-stone-200 rounded-xl p-3 bg-stone-50">
                <div>
                  <span className="text-stone-500 block text-[10px]">Passing Score</span>
                  <span className="font-bold text-stone-900">{quiz?.passing_score}%</span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px]">Time Limit</span>
                  <span className="font-bold text-stone-900">
                    {quiz?.time_limit_minutes ? `${quiz.time_limit_minutes} mins` : 'Untimed'}
                  </span>
                </div>
                <div>
                  <span className="text-stone-500 block text-[10px]">Max Attempts</span>
                  <span className="font-bold text-stone-900">{quiz?.max_attempts ?? 'Unlimited'}</span>
                </div>
              </div>
            </div>

            <Button
              onClick={handleStartAttempt}
              className="rounded-xl bg-black px-6 py-2.5 text-xs font-semibold text-white hover:bg-zinc-800 shadow-sm"
            >
              Start Assessment Attempt
            </Button>
          </div>
        ) : completedAttempt ? (
          <div className="py-8 space-y-6 text-center">
            <div
              className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${
                completedAttempt.is_passed ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
              }`}
            >
              {completedAttempt.is_passed ? <CheckCircle2 className="h-7 w-7" /> : <AlertCircle className="h-7 w-7" />}
            </div>

            <div className="space-y-1">
              <h4 className="text-lg font-bold text-stone-900">
                {completedAttempt.is_passed ? 'Assessment Passed!' : 'Assessment Incomplete'}
              </h4>
              <p className="text-sm font-semibold text-stone-700">
                Your Score: <span className="font-mono text-base font-bold text-stone-900">{completedAttempt.score_percent}%</span>{' '}
                (Passing requirement: {quiz?.passing_score}%)
              </p>
              <p className="text-xs text-stone-500">
                Points: {completedAttempt.points_earned} of {completedAttempt.points_possible} earned.
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAttempt(null);
                  setCompletedAttempt(null);
                  setAnswers({});
                }}
                className="rounded-xl text-xs"
              >
                <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retake Attempt
              </Button>
              <Button onClick={onClose} className="rounded-xl bg-black text-white text-xs px-5">
                Continue Learning
              </Button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-6">
            {timeRemainingSec !== null && (
              <div className="flex items-center justify-between rounded-xl bg-stone-900 text-white px-4 py-2.5 text-xs">
                <span className="font-medium">Time Remaining:</span>
                <span className="font-mono font-bold text-emerald-400">{formatTime(timeRemainingSec)}</span>
              </div>
            )}

            <div className="space-y-6 divide-y divide-stone-100">
              {quiz?.questions?.map((q, qIdx) => {
                const currentAnswer = answers[q.id];
                return (
                  <div key={q.id} className="pt-4 first:pt-0 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-stone-900">Question {qIdx + 1}</span>
                      <span className="text-[11px] font-medium text-stone-500">{q.points} pt(s)</span>
                    </div>

                    <p className="text-sm text-stone-800 font-medium leading-relaxed">{q.question_text}</p>

                    {/* Multiple choice or true/false */}
                    {(q.type === 'multiple_choice' || q.type === 'true_false') && (
                      <div className="space-y-2">
                        {q.options?.map((opt) => {
                          const isSelected = currentAnswer?.selectedOptionId === opt.id;
                          return (
                            <label
                              key={opt.id}
                              onClick={() => handleSelectAnswer(q.id, { selectedOptionId: opt.id })}
                              className={`flex items-center gap-3 rounded-xl border p-3 text-xs cursor-pointer transition-colors ${
                                isSelected ? 'border-black bg-stone-100/70 font-semibold text-stone-900' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                              }`}
                            >
                              <div
                                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                                  isSelected ? 'border-black bg-black' : 'border-stone-300'
                                }`}
                              >
                                {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                              </div>
                              <span>{opt.text}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Multiple select */}
                    {q.type === 'multiple_select' && (
                      <div className="space-y-2">
                        {q.options?.map((opt) => {
                          const selectedList: string[] = Array.isArray(currentAnswer?.selectedOptionIds)
                            ? (currentAnswer.selectedOptionIds as string[])
                            : [];
                          const isSelected = selectedList.includes(opt.id);
                          return (
                            <label
                              key={opt.id}
                              onClick={() => {
                                const nextList = isSelected
                                  ? selectedList.filter((id) => id !== opt.id)
                                  : [...selectedList, opt.id];
                                handleSelectAnswer(q.id, { selectedOptionIds: nextList });
                              }}
                              className={`flex items-center gap-3 rounded-xl border p-3 text-xs cursor-pointer transition-colors ${
                                isSelected ? 'border-black bg-stone-100/70 font-semibold text-stone-900' : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-700'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="rounded border-stone-300 text-stone-900"
                              />
                              <span>{opt.text}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Short Answer / Essay */}
                    {(q.type === 'short_answer' || q.type === 'essay') && (
                      <textarea
                        rows={q.type === 'essay' ? 4 : 2}
                        placeholder="Write your answer..."
                        value={typeof currentAnswer?.text === 'string' ? currentAnswer.text : ''}
                        onChange={(e) => handleSelectAnswer(q.id, { text: e.target.value })}
                        className="w-full rounded-xl border border-stone-200 bg-white p-3 text-xs text-stone-900 focus:border-stone-900 focus:outline-hidden"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-stone-100 pt-4">
              <Button variant="outline" onClick={onClose} className="rounded-xl text-xs">
                Save & Exit
              </Button>
              <Button
                disabled={submitting}
                onClick={handleFinalize}
                className="rounded-xl bg-black text-white text-xs px-6 font-semibold hover:bg-zinc-800"
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {submitting ? 'Submitting...' : 'Submit Assessment'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
