import { FC, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CloseButton from '../components/Button/CloseButton';
import './LegalPages.css';
import { useTranslation } from '../hooks/useTranslation';

const NutzungsbedingungenPage: FC = () => {
  const navigate = useNavigate();
  const { tNode, language } = useTranslation();

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      window.close();
      setTimeout(() => navigate('/'), 100);
    }
  };

  useEffect(() => {
    document.documentElement.classList.add('fonts-loaded');
  }, []);

  useEffect(() => {
    const updateProgress = () => {
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const progress = (scrollTop / scrollHeight) * 100;
      const progressBar = document.querySelector<HTMLElement>('.legal-progress-bar');
      if (progressBar) {
        progressBar.style.width = `${progress}%`;
      }
    };

    window.addEventListener('scroll', updateProgress);
    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  // SIBLING FILE: the English translation below mirrors the prerendered
  // marketing page at marketing/src/pages/terms.astro. Any wording change
  // there must be mirrored here (and vice versa), so both surfaces stay
  // identical. The German body is the binding original and mirrors
  // marketing/src/pages/nutzungsbedingungen.astro.
  const englishBody = (
    <>
      <section className="legal-section">
        <p>
          <strong>This English version is a convenience translation. The legally binding version is the German <a href="/nutzungsbedingungen/">Nutzungsbedingungen</a>.</strong>
        </p>
      </section>

      <section className="legal-section">
        <h2>§ 1 Scope of Application and Subject Matter of the Contract</h2>
        <p>(1) These Terms of Service apply to the use of the Agora Cosmica platform (hereinafter the "Platform"), operated by ChipMates gemeinnützige GmbH, Schusterstr. 50, 79098 Freiburg im Breisgau (hereinafter the "Provider").</p>
        <p>(2) The Platform offers a free, AI-powered educational service through which users can access information about historical figures from the fields of philosophy and wisdom (hereinafter the "Service"). The Service uses an AI system to generate responses automatically.</p>
        <p>(3) By using the chat service, the user accepts these Terms of Service. The other areas of the Platform (information pages, imprint, etc.) can be used without agreeing to these terms.</p>
        <p>(4) Deviating or supplementary terms of the user do not become part of the contract.</p>
      </section>

      <section className="legal-section">
        <h2>§ 2 Description of the Service and Notice on Artificial Intelligence</h2>
        <p>(1) The chat service is operated entirely by an AI system (artificial intelligence). The user does not interact with a real person but with software that automatically generates text responses.</p>
        <p>(2) The historical figures presented in the chat are fictional AI simulations. They do not reproduce the actual statements, opinions, or positions of the persons portrayed. They are expressly not authentic reproductions of historical statements.</p>
        <p>(3) AI-generated content can be factually incorrect, incomplete, outdated, or misleading (so-called "hallucinations"). Checking AI-generated content for accuracy and applicability to a specific situation is not part of the Service and is the sole responsibility of the user.</p>
        <p>(4) The Service does not constitute professional advice, in particular no medical, psychological, legal, or financial advice. AI-generated content does not replace consultation of qualified professionals.</p>
        <p>(5) The Provider reserves the right to restrict, change, or discontinue the Service in whole or in part at any time. There is no entitlement to uninterrupted availability.</p>
      </section>

      <section className="legal-section">
        <h2>§ 3 Access and Age Requirement</h2>
        <p>(1) Use of the chat service requires agreement to these Terms of Service as well as confirmation of the minimum age.</p>
        <p>(2) The chat service is intended for persons aged 16 and over. Persons under 16 may use the Service only with the consent of a parent or legal guardian. In these cases, personal data is processed exclusively on the basis of this consent pursuant to Art. 6(1)(a) GDPR. By confirming their age, the user affirms that they are at least 16 years old or have the required consent of a parent or legal guardian.</p>
        <p>(3) Within the scope of application of the US Children's Online Privacy Protection Act (COPPA), use of the Service by persons under 13 is prohibited.</p>
        <p>(4) The Provider reserves the right to restrict access if there are indications that a user does not meet the age requirements.</p>
      </section>

      <section className="legal-section">
        <h2>§ 4 Rules of Use</h2>
        <p>(1) The Service may be used exclusively for private, non-commercial, and educational purposes.</p>
        <p>(2) It is prohibited:</p>
        <p>a) to use the Service for unlawful purposes or to generate unlawful content, in particular content that incites hatred (Sect. 130 of the German Criminal Code, StGB), insulting content, or other content punishable under criminal law;</p>
        <p>b) to circumvent, manipulate, or defeat the technical security mechanisms of the Service, in particular through so-called "prompt injection" or "jailbreaking";</p>
        <p>c) to present or distribute AI-generated content as authentic statements of the historical figures portrayed;</p>
        <p>d) to query the Service systematically or in an automated manner, for example through bots, scrapers, or automated scripts;</p>
        <p>e) to present AI-generated content as text written by a human or to conceal its AI origin;</p>
        <p>f) to use the Service to create content that disparages or insults real living persons or violates their personality rights;</p>
        <p>g) to enter personal data of third parties into the chat;</p>
        <p>h) to use the Service to generate content that sexualizes or exploits minors or depicts them in contexts glorifying violence (Sect. 131, 184b, 184c StGB).</p>
        <p>(3) The user acknowledges that the Service uses technical content filters that can block certain inputs or restrict responses. These measures serve the protection of minors and compliance with legal requirements.</p>
      </section>

      <section className="legal-section">
        <h2>§ 5 Intellectual Property and Rights of Use</h2>
        <p>(1) The Platform, its design, its texts, graphics, and software components are protected by copyright. All rights remain with the Provider or the respective rights holders.</p>
        <p>(2) Under the current legal situation, there are presumably no copyrights in the AI-generated chat responses, as they lack a personal intellectual creation. Should the Provider nevertheless hold rights to the outputs, the Provider grants the user a non-exclusive, non-transferable right to use them for private and educational purposes.</p>
        <p>(3) The user's inputs (prompts) remain with the user. The Provider acquires no rights to the inputs and uses them exclusively to provide the Service (transmission to the AI service provider for answering). The Provider does not store or analyze the inputs beyond this; further information is provided in the Privacy Policy.</p>
      </section>

      <section className="legal-section">
        <h2>§ 6 Data Protection</h2>
        <p>(1) The Provider processes personal data exclusively in accordance with the applicable data protection laws, in particular the GDPR and the BDSG (the German Federal Data Protection Act). For details, please see our <a href="/privacy/">Privacy Policy</a>.</p>
        <p>(2) When the chat is used, the user's inputs are transmitted to an AI service provider, which processes them to generate the response. Further details can be found in the Privacy Policy.</p>
        <p>(3) The user is asked not to enter any personal data (in particular name, address, phone number, email) into the chat.</p>
      </section>

      <section className="legal-section">
        <h2>§ 7 Protection of Minors</h2>
        <p>(1) The Provider has appointed a Youth Protection Officer pursuant to Sect. 7 JMStV (the German Interstate Treaty on the Protection of Minors in the Media). Their contact details are provided in the <Link to="/impressum#jugendschutz">Imprint</Link>.</p>
        <p>(2) The Service uses technical protective measures to prevent the generation of content harmful to minors. Despite these measures, it cannot be ruled out that AI-generated content may be inappropriate in individual cases.</p>
        <p>(3) Users and legal guardians can report problematic content via the reporting function in the chat or by email to <a href="mailto:chipmates@chipmates.ai">chipmates@chipmates.ai</a>.</p>
        <p>(4) If you are in a crisis or need help, please contact the Telefonseelsorge crisis line (0800 111 0 111, free of charge, 24/7) or the Nummer gegen Kummer helpline (116 111).</p>
      </section>

      <section className="legal-section">
        <h2>§ 8 Liability</h2>
        <p>(1) The Provider is liable without limitation for damages arising from injury to life, body, or health that are based on a negligent or intentional breach of duty.</p>
        <p>(2) The Provider is liable without limitation for damages caused by intent or gross negligence.</p>
        <p>(3) In the event of a slightly negligent breach of essential contractual obligations (cardinal obligations), liability is limited to the foreseeable damage typical for this type of contract.</p>
        <p>(4) In all other respects, the Provider's liability for damages caused by slight negligence, in particular for damages arising from the use of or reliance on AI-generated content, is excluded. This applies taking into account that the Service is provided free of charge.</p>
        <p>(5) The above limitations of liability do not apply to claims under the German Product Liability Act or where a guarantee has been given.</p>
        <p>(6) The Provider gives no warranty for the accuracy, completeness, or currency of the AI-generated content. The user uses the content at their own risk.</p>
      </section>

      <section className="legal-section">
        <h2>§ 9 Blocking and Exclusion</h2>
        <p>(1) The Provider is entitled to block a user's access to the Service temporarily or permanently if the user violates these Terms of Service or misuses the Service.</p>
        <p>(2) In the event of a block due to violations, no prior notice is given.</p>
      </section>

      <section className="legal-section">
        <h2>§ 10 Changes to the Terms of Service</h2>
        <p>(1) The Provider is entitled to change these Terms of Service with effect for the future, provided this is necessary due to changes in the legal situation, the introduction of new features, the fixing of security vulnerabilities, or other objective reasons, and the user is not unreasonably disadvantaged as a result.</p>
        <p>(2) In the event of changes, the updated version will be shown to the user for renewed consent the next time they use the chat service.</p>
      </section>

      <section className="legal-section">
        <h2>§ 11 Content Moderation and Reporting Options</h2>
        <p>(1) The Provider uses automated content filters to prevent the generation of unlawful content or content harmful to minors.</p>
        <p>(2) Users can report problematic AI-generated content via the "Report content" button in the chat. Reports are reviewed and answered promptly.</p>
      </section>

      <section className="legal-section">
        <h2>§ 12 Applicable Law and Dispute Resolution</h2>
        <p>(1) These Terms of Service are governed by the law of the Federal Republic of Germany, excluding the UN Convention on Contracts for the International Sale of Goods.</p>
        <p>(2) If the user is a consumer within the meaning of Sect. 13 BGB (the German Civil Code) and has their habitual residence in another country, mandatory consumer protection provisions of that country remain unaffected.</p>
        <p>(3) The European Commission provides a platform for online dispute resolution (ODR): <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a>. The Provider is neither willing nor obliged to participate in dispute resolution proceedings before a consumer arbitration board.</p>
      </section>

      <section className="legal-section">
        <h2>§ 13 Contact</h2>
        <p>
          ChipMates gemeinnützige GmbH<br/>
          Schusterstr. 50<br/>
          79098 Freiburg im Breisgau, Germany<br/>
          Email: <a href="mailto:chipmates@chipmates.ai">chipmates@chipmates.ai</a>
        </p>
      </section>
    </>
  );

  const germanBody = (
    <>
        <section className="legal-section">
          <h2>§ 1 Geltungsbereich und Vertragsgegenstand</h2>
          <p>(1) Diese Nutzungsbedingungen gelten für die Nutzung der Plattform Agora Cosmica (nachfolgend "Plattform"), betrieben von ChipMates gemeinnützige GmbH, Schusterstr. 50, 79098 Freiburg im Breisgau (nachfolgend "Anbieter").</p>
          <p>(2) Die Plattform bietet einen kostenfreien, KI-gestützten Bildungsdienst, bei dem Nutzer Informationen über historische Persönlichkeiten aus den Bereichen Philosophie und Weisheit abrufen können (nachfolgend "Dienst"). Der Dienst nutzt ein KI-System zur automatischen Generierung von Antworten.</p>
          <p>(3) Mit der Nutzung des Chat-Dienstes akzeptiert der Nutzer diese Nutzungsbedingungen. Die Nutzung der übrigen Bereiche der Plattform (Informationsseiten, Impressum etc.) ist ohne Zustimmung zu diesen Bedingungen möglich.</p>
          <p>(4) Abweichende oder ergänzende Bedingungen des Nutzers werden nicht Vertragsbestandteil.</p>
        </section>

        <section className="legal-section">
          <h2>§ 2 Leistungsbeschreibung und Hinweis auf Künstliche Intelligenz</h2>
          <p>(1) Der Chat-Dienst wird vollständig von einem KI-System (Künstliche Intelligenz) betrieben. Der Nutzer interagiert nicht mit einer realen Person, sondern mit einer Software, die automatisch Textantworten generiert.</p>
          <p>(2) Die im Chat dargestellten historischen Persönlichkeiten sind fiktive KI-Simulationen. Sie geben nicht die tatsächlichen Aussagen, Meinungen oder Positionen der dargestellten Personen wieder. Es handelt sich ausdrücklich nicht um authentische Wiedergaben historischer Äußerungen.</p>
          <p>(3) KI-generierte Inhalte können sachlich unrichtig, unvollständig, veraltet oder irreführend sein (sogenannte "Halluzinationen"). Die Überprüfung der KI-generierten Inhalte auf Richtigkeit und Anwendbarkeit auf einen konkreten Sachverhalt ist nicht Teil des Dienstes und obliegt allein dem Nutzer.</p>
          <p>(4) Der Dienst stellt keine professionelle Beratung dar, insbesondere keine medizinische, psychologische, rechtliche oder finanzielle Beratung. KI-generierte Inhalte ersetzen nicht die Konsultation qualifizierter Fachpersonen.</p>
          <p>(5) Der Anbieter behält sich vor, den Dienst jederzeit ganz oder teilweise einzuschränken, zu ändern oder einzustellen. Ein Anspruch auf ununterbrochene Verfügbarkeit besteht nicht.</p>
        </section>

        <section className="legal-section">
          <h2>§ 3 Zugang und Altersanforderung</h2>
          <p>(1) Die Nutzung des Chat-Dienstes setzt die Zustimmung zu diesen Nutzungsbedingungen sowie die Bestätigung des Mindestalters voraus.</p>
          <p>(2) Der Chat-Dienst ist für Personen ab 16 Jahren bestimmt. Personen unter 16 Jahren dürfen den Dienst nur mit Zustimmung eines Erziehungsberechtigten nutzen. Die Verarbeitung personenbezogener Daten erfolgt in diesen Fällen ausschließlich auf Grundlage dieser Zustimmung gemäß Art. 6 Abs. 1 lit. a) DSGVO. Mit der Altersbestätigung versichert der Nutzer, dass er mindestens 16 Jahre alt ist oder über die erforderliche Zustimmung eines Erziehungsberechtigten verfügt.</p>
          <p>(3) Im Geltungsbereich des US-amerikanischen Children's Online Privacy Protection Act (COPPA) ist die Nutzung des Dienstes durch Personen unter 13 Jahren untersagt.</p>
          <p>(4) Der Anbieter behält sich vor, den Zugang zu beschränken, wenn Anhaltspunkte dafür bestehen, dass ein Nutzer die Altersanforderungen nicht erfüllt.</p>
        </section>

        <section className="legal-section">
          <h2>§ 4 Nutzungsregeln</h2>
          <p>(1) Der Dienst darf ausschließlich zu privaten, nicht-kommerziellen und bildungsbezogenen Zwecken genutzt werden.</p>
          <p>(2) Es ist untersagt:</p>
          <p>a) den Dienst für rechtswidrige Zwecke zu nutzen oder rechtswidrige Inhalte zu erzeugen, insbesondere volksverhetzende (§ 130 StGB), beleidigende oder sonst strafbare Inhalte;</p>
          <p>b) die technischen Sicherheitsmechanismen des Dienstes zu umgehen, zu manipulieren oder auszuhebeln, insbesondere durch sogenanntes "Prompt Injection" oder "Jailbreaking";</p>
          <p>c) KI-generierte Inhalte als authentische Aussagen der dargestellten historischen Persönlichkeiten auszugeben oder zu verbreiten;</p>
          <p>d) den Dienst systematisch oder automatisiert abzufragen, etwa durch Bots, Scraper oder automatisierte Skripte;</p>
          <p>e) KI-generierte Inhalte als menschlich verfasste Texte auszugeben oder deren KI-Herkunft zu verschleiern;</p>
          <p>f) den Dienst zur Erstellung von Inhalten zu nutzen, die reale lebende Personen verunglimpfen, beleidigen oder deren Persönlichkeitsrechte verletzen;</p>
          <p>g) persönliche Daten Dritter in den Chat einzugeben;</p>
          <p>h) den Dienst zur Erzeugung von Inhalten zu nutzen, die Minderjährige sexualisieren, ausbeuten oder in gewaltverherrlichenden Kontexten darstellen (§§ 131, 184b, 184c StGB).</p>
          <p>(3) Der Nutzer nimmt zur Kenntnis, dass der Dienst technische Inhaltsfilter einsetzt, die bestimmte Eingaben blockieren oder Antworten einschränken können. Diese Maßnahmen dienen dem Jugendschutz und der Einhaltung gesetzlicher Vorgaben.</p>
        </section>

        <section className="legal-section">
          <h2>§ 5 Geistiges Eigentum und Nutzungsrechte</h2>
          <p>(1) Die Plattform, ihr Design, ihre Texte, Grafiken und Softwarekomponenten sind urheberrechtlich geschützt. Alle Rechte verbleiben beim Anbieter bzw. den jeweiligen Rechteinhabern.</p>
          <p>(2) An den KI-generierten Chat-Antworten bestehen nach derzeitiger Rechtslage voraussichtlich keine Urheberrechte, da es an einer persönlichen geistigen Schöpfung fehlt. Soweit dem Anbieter dennoch Rechte an den Outputs zustehen sollten, räumt er dem Nutzer ein einfaches, nicht übertragbares Nutzungsrecht für private und bildungsbezogene Zwecke ein.</p>
          <p>(3) Die Eingaben (Prompts) des Nutzers verbleiben beim Nutzer. Der Anbieter erwirbt an den Eingaben keine Rechte und nutzt sie ausschließlich zur Erbringung des Dienstes (Übermittlung an den KI-Dienstleister zur Beantwortung). Eine darüber hinausgehende Speicherung oder Auswertung der Eingaben durch den Anbieter erfolgt nicht; weitere Hinweise enthält die Datenschutzerklärung.</p>
        </section>

        <section className="legal-section">
          <h2>§ 6 Datenschutz</h2>
          <p>(1) Der Anbieter verarbeitet personenbezogene Daten ausschließlich nach Maßgabe der geltenden Datenschutzgesetze, insbesondere der DSGVO und des BDSG. Einzelheiten entnehmen Sie bitte unserer <Link to="/datenschutz">Datenschutzerklärung</Link>.</p>
          <p>(2) Im Rahmen der Chat-Nutzung werden die Eingaben des Nutzers an einen KI-Dienstleister übermittelt, der diese zur Erzeugung der Antwort verarbeitet. Näheres hierzu finden Sie in der Datenschutzerklärung.</p>
          <p>(3) Der Nutzer wird gebeten, keine personenbezogenen Daten (insbesondere Name, Adresse, Telefonnummer, E-Mail) in den Chat einzugeben.</p>
        </section>

        <section className="legal-section">
          <h2>§ 7 Jugendschutz</h2>
          <p>(1) Der Anbieter hat gemäß § 7 JMStV einen Jugendschutzbeauftragten bestellt. Dessen Kontaktdaten sind im <Link to="/impressum#jugendschutz">Impressum</Link> angegeben.</p>
          <p>(2) Der Dienst setzt technische Schutzmaßnahmen ein, um die Erzeugung jugendgefährdender Inhalte zu verhindern. Trotz dieser Maßnahmen kann nicht ausgeschlossen werden, dass KI-generierte Inhalte im Einzelfall unangemessen sein können.</p>
          <p>(3) Nutzer und Erziehungsberechtigte können problematische Inhalte über die Meldefunktion im Chat oder per E-Mail an <a href="mailto:chipmates@chipmates.ai">chipmates@chipmates.ai</a> melden.</p>
          <p>(4) Sollten Sie sich in einer Krise befinden oder Hilfe benötigen, wenden Sie sich bitte an die Telefonseelsorge (0800 111 0 111, kostenlos, 24/7) oder an die Nummer gegen Kummer (116 111).</p>
        </section>

        <section className="legal-section">
          <h2>§ 8 Haftung</h2>
          <p>(1) Der Anbieter haftet unbeschränkt für Schäden aus der Verletzung des Lebens, des Körpers oder der Gesundheit, die auf einer fahrlässigen oder vorsätzlichen Pflichtverletzung beruhen.</p>
          <p>(2) Der Anbieter haftet unbeschränkt für Schäden, die durch Vorsatz oder grobe Fahrlässigkeit verursacht wurden.</p>
          <p>(3) Bei leicht fahrlässiger Verletzung wesentlicher Vertragspflichten (Kardinalpflichten) ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt.</p>
          <p>(4) Im Übrigen ist die Haftung des Anbieters für leicht fahrlässig verursachte Schäden, insbesondere für Schäden, die aus der Nutzung oder dem Vertrauen auf KI-generierte Inhalte entstehen, ausgeschlossen. Dies gilt unter Berücksichtigung der Unentgeltlichkeit des Dienstes.</p>
          <p>(5) Die vorstehenden Haftungsbeschränkungen gelten nicht für Ansprüche nach dem Produkthaftungsgesetz sowie bei der Übernahme einer Garantie.</p>
          <p>(6) Der Anbieter übernimmt keine Gewähr für die Richtigkeit, Vollständigkeit oder Aktualität der KI-generierten Inhalte. Der Nutzer nutzt die Inhalte auf eigenes Risiko.</p>
        </section>

        <section className="legal-section">
          <h2>§ 9 Sperrung und Ausschluss</h2>
          <p>(1) Der Anbieter ist berechtigt, den Zugang eines Nutzers zum Dienst vorübergehend oder dauerhaft zu sperren, wenn der Nutzer gegen diese Nutzungsbedingungen verstößt oder den Dienst missbräuchlich nutzt.</p>
          <p>(2) Im Falle einer Sperrung aufgrund von Verstößen erfolgt keine vorherige Ankündigung.</p>
        </section>

        <section className="legal-section">
          <h2>§ 10 Änderung der Nutzungsbedingungen</h2>
          <p>(1) Der Anbieter ist berechtigt, diese Nutzungsbedingungen mit Wirkung für die Zukunft zu ändern, sofern dies aufgrund von Änderungen der Rechtslage, Einführung neuer Funktionen, Behebung von Sicherheitslücken oder sonstigen sachlichen Gründen erforderlich ist und der Nutzer dadurch nicht unangemessen benachteiligt wird.</p>
          <p>(2) Bei Änderungen wird dem Nutzer bei seiner nächsten Nutzung des Chat-Dienstes die aktualisierte Version zur erneuten Zustimmung angezeigt.</p>
        </section>

        <section className="legal-section">
          <h2>§ 11 Inhaltemoderation und Meldemöglichkeiten</h2>
          <p>(1) Der Anbieter setzt automatisierte Inhaltsfilter ein, um die Erzeugung rechtswidriger oder jugendgefährdender Inhalte zu verhindern.</p>
          <p>(2) Nutzer können problematische KI-generierte Inhalte über den "Inhalt melden"-Button im Chat melden. Meldungen werden zeitnah geprüft und beantwortet.</p>
        </section>

        <section className="legal-section">
          <h2>§ 12 Anwendbares Recht und Streitbeilegung</h2>
          <p>(1) Diese Nutzungsbedingungen unterliegen dem Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts.</p>
          <p>(2) Soweit der Nutzer Verbraucher im Sinne des § 13 BGB ist und seinen gewöhnlichen Aufenthalt in einem anderen Staat hat, bleiben zwingende Verbraucherschutzvorschriften dieses Staates unberührt.</p>
          <p>(3) Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a>. Der Anbieter ist weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
        </section>

        <section className="legal-section">
          <h2>§ 13 Kontakt</h2>
          <p>
            ChipMates gemeinnützige GmbH<br/>
            Schusterstr. 50<br/>
            79098 Freiburg im Breisgau<br/>
            E-Mail: <a href="mailto:chipmates@chipmates.ai">chipmates@chipmates.ai</a>
          </p>
        </section>
    </>
  );

  return (
    <div className="legal-page">
      <div className="legal-progress">
        <div className="legal-progress-bar"></div>
      </div>

      <CloseButton onClick={handleClose} size="md" className="legal-close-btn" />

      <div className="legal-container">
        <header className="legal-header">
          <h1 className="legal-title">{tNode('legal.terms.title')}</h1>
          {/* Version maps the stored consent record (WelcomeDisclosureModal
              CURRENT_AGB_VERSION) to this published text. */}
          <p className="legal-date">Version 1.0.0 · {tNode('legal.terms.lastUpdated')}</p>
        </header>

        {language === 'en' ? englishBody : germanBody}

        <div className="legal-footer">
          <div className="legal-links">
            <Link to="/impressum" className="legal-link">
              {tNode('legal.links.imprint')}
            </Link>
            <span className="legal-separator">•</span>
            <Link to="/datenschutz" className="legal-link">
              {tNode('legal.links.privacy')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NutzungsbedingungenPage;
