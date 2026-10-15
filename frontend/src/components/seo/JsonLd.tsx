import React from "react";

type JsonLdProps = {
  data: Record<string, any> | Array<Record<string, any>>;
};

/**
 * JsonLd component safely serializes structured data into an application/ld+json script tag.
 * Replaces '<' with unicode escape '\u003c' to prevent script-injection / XSS attacks.
 */
export function JsonLd({ data }: JsonLdProps) {
  const jsonString = JSON.stringify(data).replace(/</g, "\\u003c");

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonString }}
    />
  );
}

export default JsonLd;

