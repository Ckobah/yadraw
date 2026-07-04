"use client";

import { useMemo, useState } from "react";
import { Bot, X } from "lucide-react";
import {
  V2_ASSISTANT_QUESTIONS,
  answerBoardAssistantQuestion,
  type V2AssistantQuestionId,
  type V2BoardAssistantContext,
} from "./v2-board-assistant";

type V2AiAssistantPanelProps = {
  context: V2BoardAssistantContext;
  onClose: () => void;
};

export function V2AiAssistantPanel({
  context,
  onClose,
}: V2AiAssistantPanelProps) {
  const [activeQuestionId, setActiveQuestionId] =
    useState<V2AssistantQuestionId>("summary");
  const answer = useMemo(
    () => answerBoardAssistantQuestion(activeQuestionId, context),
    [activeQuestionId, context]
  );

  return (
    <aside
      className="v2AiAssistantPanel nodrag nopan"
      aria-label="AI Assistant"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="v2AiAssistantHeader">
        <span className="v2AiAssistantIcon" aria-hidden="true">
          <Bot size={17} strokeWidth={2.2} />
        </span>
        <div>
          <h2>AI Assistant</h2>
          <span>Demo deterministic mode</span>
        </div>
        <button
          type="button"
          className="v2AiAssistantCloseButton"
          aria-label="Close AI Assistant"
          onClick={onClose}
        >
          <X size={15} strokeWidth={2.3} />
        </button>
      </div>

      <div className="v2AiAssistantNotice">
        No AI model is called. Answers are generated from the board state loaded in this browser.
      </div>

      <div className="v2AiAssistantQuestionList" aria-label="Assistant questions">
        {V2_ASSISTANT_QUESTIONS.map((question) => (
          <button
            key={question.id}
            type="button"
            className={
              question.id === activeQuestionId
                ? "v2AiAssistantQuestion v2AiAssistantQuestionActive"
                : "v2AiAssistantQuestion"
            }
            onClick={() => setActiveQuestionId(question.id)}
          >
            {question.label}
          </button>
        ))}
      </div>

      <section className="v2AiAssistantAnswer" aria-live="polite">
        <h3>{answer.title}</h3>
        <ul>
          {answer.lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
