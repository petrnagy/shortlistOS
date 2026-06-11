import Head from "next/head";

export const PageHead = ({ title }: { title: string }) => {
  return (
    <Head>
      <title>{title}</title>
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1"
      />
      <link rel="icon" href="/images/favicon/logo-v3.2_640x640px_radius.png" />
      <link rel="manifest" href="/manifest.json" />
    </Head>
  );
};
