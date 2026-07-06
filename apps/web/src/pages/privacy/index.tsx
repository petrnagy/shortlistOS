import type { GetStaticProps, InferGetStaticPropsType } from "next";

import { loadLegalDocument } from "~/utils/legal-content";
import PrivacyView from "~/views/privacy";

export const getStaticProps: GetStaticProps<{
  content: ReturnType<typeof loadLegalDocument>;
}> = () => {
  return {
    props: {
      content: loadLegalDocument("privacy-policy", "Privacy Policy"),
    },
  };
};

export default function Privacy({
  content,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return <PrivacyView content={content} />;
}
