import { Hero } from "@/components/sections/Hero";
import { TrustMetrics } from "@/components/sections/TrustMetrics";
import { ServiceCategories } from "@/components/sections/ServiceCategories";
import Footer from "@/components/sections/Footer";
import { JsonLd } from "@/components/seo/JsonLd";
import { SITE_URL, DEFAULT_DESCRIPTION, SUPPORT_EMAIL, SOCIAL_PROFILES } from "@/lib/seo";

export default function Home() {
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: "BelConnect",
    url: SITE_URL,
    description: DEFAULT_DESCRIPTION,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/services?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
    inLanguage: ["en-IN", "kn-IN"],
  };

  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "BelConnect",
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/belconnect.png`,
      width: 512,
      height: 512,
    },
    description: "Belagavi's local marketplace for verified home services and job opportunities.",
    areaServed: [
      {
        "@type": "City",
        name: "Belagavi",
        alternateName: "Belgaum",
        containedInPlace: {
          "@type": "State",
          name: "Karnataka",
        },
        postalCode: [
          "590001", "590002", "590003", "590004", "590005",
          "590006", "590007", "590008", "590009", "590010",
          "590011", "590012", "590013", "590014", "590015",
          "590016", "590017", "590018", "590019", "590020",
        ],
      },
    ],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: SUPPORT_EMAIL,
        availableLanguage: ["English", "Kannada", "Hindi", "Marathi"],
      },
    ],
    sameAs: Object.values(SOCIAL_PROFILES).filter(Boolean),
  };

  return (
    <>
      <JsonLd data={[websiteSchema, organizationSchema]} />
      <Hero />
      <TrustMetrics />
      <ServiceCategories />
      <Footer />
    </>
  );
}
