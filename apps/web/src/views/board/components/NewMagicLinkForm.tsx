import { t } from "@lingui/core/macro";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { HiXMark } from "react-icons/hi2";

import Button from "~/components/Button";
import Input from "~/components/Input";
import { useModalFormState } from "~/hooks/useModalFormState";
import { useModal } from "~/providers/modal";
import { usePopup } from "~/providers/popup";
import { api } from "~/utils/api";

interface NewMagicLinkFormInput {
  url: string;
}

interface NewMagicLinkFormProps {
  boardPublicId: string;
}

export function NewMagicLinkForm({ boardPublicId }: NewMagicLinkFormProps) {
  const { showPopup } = usePopup();
  const { closeModal } = useModal();
  const utils = api.useUtils();

  const { formState, saveFormState } =
    useModalFormState<NewMagicLinkFormInput>({
      modalType: "NEW_MAGIC_LINK",
      initialValues: {
        url: "",
      },
      resetOnClose: true,
    });

  const { register, handleSubmit, watch } = useForm<NewMagicLinkFormInput>({
    values: formState,
  });

  const url = watch("url");

  useEffect(() => {
    const subscription = watch((data) => {
      saveFormState(data as NewMagicLinkFormInput);
    });

    return () => subscription.unsubscribe();
  }, [watch, saveFormState]);

  useEffect(() => {
    const urlElement = document.querySelector<HTMLElement>("#magic-link-url");
    urlElement?.focus();
  }, []);

  const createMagicLink = api.shortlist.createMagicLink.useMutation({
    onError: (error) => {
      showPopup({
        header: t`Unable to create card`,
        message:
          error.data?.zodError?.fieldErrors.url?.[0] ??
          t`Please try again later, or contact customer support.`,
        icon: "error",
      });
    },
    onSuccess: async () => {
      closeModal();
      await utils.board.byId.invalidate();
      showPopup({
        header: t`Card creation queued`,
        message: t`We saved the URL and will turn it into a card shortly.`,
        icon: "success",
      });
    },
  });

  const onSubmit = (data: NewMagicLinkFormInput) => {
    createMagicLink.mutate({
      boardPublicId,
      url: data.url,
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div className="px-5 pt-5">
        <div className="flex w-full items-center justify-between pb-5">
          <h2 className="text-sm font-bold text-neutral-900 dark:text-dark-1000">
            {t`New opportunity via URL`}
          </h2>
          <button
            type="button"
            className="rounded p-1 hover:bg-light-200 focus:outline-none dark:hover:bg-dark-300"
            onClick={(e) => {
              closeModal();
              e.preventDefault();
            }}
          >
            <HiXMark size={18} className="text-light-900 dark:text-dark-900" />
          </button>
        </div>

        <Input
          id="magic-link-url"
          type="url"
          placeholder="https://example.com/opportunity"
          {...register("url", { required: true })}
          onKeyDown={async (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              await handleSubmit(onSubmit)();
            }
          }}
        />
      </div>

      <div className="mt-5 flex items-center justify-end border-t border-light-600 px-5 pb-5 pt-5 dark:border-dark-600">
        <Button
          type="submit"
          disabled={url.trim().length === 0 || createMagicLink.isPending}
        >
          {t`Create card`}
        </Button>
      </div>
    </form>
  );
}
