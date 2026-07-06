import type { GetStaticProps, InferGetStaticPropsType } from "next";

import { loadLegalDocument } from "~/utils/legal-content";
import TermsView from "~/views/terms";

export const getStaticProps: GetStaticProps<{
  content: ReturnType<typeof loadLegalDocument>;
}> = () => {
  return {
    props: {
      content: loadLegalDocument("terms-of-use", "Terms of Use"),
    },
  };
};

export default function Terms({
  content,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  return <TermsView content={content} />;
}
