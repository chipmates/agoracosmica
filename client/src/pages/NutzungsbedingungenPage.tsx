import React, { FC, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CloseButton from '../components/Button/CloseButton';
import './LegalPages.css';
import { useTranslation } from '../hooks/useTranslation';

const NutzungsbedingungenPage: FC = () => {
  const navigate = useNavigate();
  const { tNode } = useTranslation();

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

  return (
    <div className="legal-page">
      <div className="legal-progress">
        <div className="legal-progress-bar"></div>
      </div>

      <CloseButton onClick={handleClose} size="md" className="legal-close-btn" />

      <div className="legal-container">
        <header className="legal-header">
          <h1 className="legal-title">{tNode('legal.terms.title')}</h1>
          <p className="legal-date">{tNode('legal.terms.lastUpdated')}</p>
        </header>

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
