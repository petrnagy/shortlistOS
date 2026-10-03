import Link from "next/link";
import { t } from "@lingui/core/macro";
import { useForm } from "react-hook-form";
import { HiXMark } from "react-icons/hi2";

import Button from "~/components/Button";
import Input from "~/components/Input";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";

interface FeedbackFormInput {
  feedback: string;
}

export default function FeedbackForm({
  standalone = false,
}: {
  standalone?: boolean;
}) {
  const { closeModal } = useModal();
  const { showPopup } = usePopup();

  const { handleSubmit, setValue, watch, reset } = useForm<FeedbackFormInput>({
    defaultValues: { feedback: "" },
  });

  const createFeedback = api.feedback.create.useMutation({
    onSuccess: () => {
      reset();
      if (!standalone) closeModal();
      showPopup({
        header: t`Feedback sent`,
        message: t`Thank you for your feedback!`,
        icon: "success",
      });
    },
    onError: () => {
      showPopup({
        header: t`Unable to send feedback`,
        message: t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
  });

  const onSubmit = (values: FeedbackFormInput) => {
    createFeedback.mutate({
      feedback: values.feedback,
      url: window.location.href,
    });
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className={
        standalone
          ? "rounded-xl border border-light-300 bg-white p-6 dark:border-dark-300 dark:bg-dark-100"
          : ""
      }
    >
      <div className={standalone ? "" : "px-5 pt-5"}>
        <div className="flex w-full items-center justify-between pb-4">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-dark-1000">
            {t`Feedback`}
          </h2>
          {!standalone && (
            <button
              type="button"
              className="rounded p-1 hover:bg-light-200 focus:outline-none dark:hover:bg-dark-300"
              onClick={(event) => {
                event.preventDefault();
                closeModal();
              }}
            >
              <HiXMark
                size={18}
                className="text-light-900 dark:text-dark-900"
              />
            </button>
          )}
        </div>

        <Input
          id="feedback"
          placeholder={t`Ideas to improve this page...`}
          onChange={(event) => setValue("feedback", event.target.value)}
          contentEditable
          value={watch("feedback")}
          className="min-h-[120px]"
          onKeyDown={async (event) => {
            event.stopPropagation();
            if (event.key === "Enter" && event.shiftKey) {
              event.preventDefault();
              await handleSubmit(onSubmit)();
            }
            if (event.key === "Escape" && !standalone) closeModal();
          }}
        />
      </div>
      <div
        className={
          standalone
            ? "mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-light-300 pt-5 dark:border-dark-600"
            : "mt-6 flex items-center justify-between border-t border-light-600 px-5 pb-5 pt-5 dark:border-dark-600"
        }
      >
        <div className="text-xs text-neutral-600 dark:text-dark-800">
          <p>
            {t`Need help?`}{" "}
            <Link
              href="/contact"
              className="text-blue-600 underline dark:text-blue-300"
            >
              {t`Contact us`}
            </Link>
            {t`, or see our`}{" "}
            <Link
              href="https://docs.shortlistos.co"
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline dark:text-blue-300"
            >
              {t`docs`}
            </Link>
            .
          </p>
        </div>
        <Button type="submit" isLoading={createFeedback.isPending}>
          {t`Send feedback`}
        </Button>
      </div>
    </form>
  );
}
