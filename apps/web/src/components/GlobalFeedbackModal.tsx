import FeedbackModal from "~/components/FeedbackModal";
import Modal from "~/components/modal";
import { useModal } from "~/providers/modal";

export function GlobalFeedbackModal() {
  const { isOpen, modalContentType } = useModal();

  return (
    <Modal
      modalSize="md"
      isVisible={isOpen && modalContentType === "NEW_FEEDBACK"}
    >
      <FeedbackModal />
    </Modal>
  );
}
