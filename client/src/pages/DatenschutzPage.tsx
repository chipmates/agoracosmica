import { FC, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CloseButton from '../components/Button/CloseButton';
import './LegalPages.css';
import { useTranslation } from '../hooks/useTranslation';

const DatenschutzPage: FC = () => {
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

  // Add fonts-loaded class when fonts are ready
  useEffect(() => {
    document.documentElement.classList.add('fonts-loaded');
  }, []);

  // Update scroll progress
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
          <h1 className="legal-title">{tNode('legal.privacy.title')}</h1>
          <p className="legal-date">{tNode('legal.privacy.lastUpdated')}</p>
        </header>


        <section className="legal-section">
          <h2>Präambel</h2>
          <p>
            Mit der folgenden Datenschutzerklärung möchten wir Sie darüber aufklären, welche Arten Ihrer personenbezogenen Daten (nachfolgend auch kurz als "Daten" bezeichnet) wir zu welchen Zwecken und in welchem Umfang verarbeiten. Die Datenschutzerklärung gilt für alle von uns durchgeführten Verarbeitungen personenbezogener Daten, sowohl im Rahmen der Erbringung unserer Leistungen als auch insbesondere auf unseren Webseiten, in mobilen Applikationen sowie innerhalb externer Onlinepräsenzen, wie z. B. unserer Social-Media-Profile (nachfolgend zusammenfassend bezeichnet als "Onlineangebot").
          </p>
          <p>
            Die verwendeten Begriffe sind nicht geschlechtsspezifisch.
          </p>
          <p>
            <strong>Inhaltsübersicht</strong><br/>
            * Präambel<br/>
            * Verantwortlicher<br/>
            * Übersicht der Verarbeitungen<br/>
            * Maßgebliche Rechtsgrundlagen<br/>
            * Sicherheitsmaßnahmen<br/>
            * Internationale Datentransfers<br/>
            * Rechte der betroffenen Personen<br/>
            * Einsatz von Cookies und lokale Speicherung<br/>
            * Bereitstellung des Onlineangebotes und Webhosting<br/>
            * KI-gestützter Chat-Dienst<br/>
            * Audio-Dienst<br/>
            * Community-Zählung<br/>
            * Bot-Schutz (Cloudflare Turnstile)<br/>
            * Conversion-Messung (Google Ads)<br/>
            * Reichweitenmessung<br/>
            * Auftragsverarbeiter
          </p>
        </section>

        <section className="legal-section">
          <h2>Verantwortlicher</h2>
          <p>
            ChipMates gemeinnützige GmbH<br/>
            vertreten durch Michael Strasser<br/>
            Schusterstr. 50<br/>
            79098 Freiburg im Breisgau<br/>
            E-Mail: <a href="mailto:chipmates@chipmates.ai">chipmates@chipmates.ai</a>
          </p>
          <p>
            Ein Datenschutzbeauftragter ist nicht bestellt, da die gesetzlichen Voraussetzungen hierfür nicht vorliegen (§ 38 BDSG).
          </p>
        </section>

        <section className="legal-section">
          <h2>Übersicht der Verarbeitungen</h2>
          <p>
            Die nachfolgende Übersicht fasst die Arten der verarbeiteten Daten und die Zwecke ihrer Verarbeitung zusammen und verweist auf die betroffenen Personen.
          </p>
          <p>
            <strong>Arten der verarbeiteten Daten:</strong><br/>
            * Kontaktdaten<br/>
            * Inhaltsdaten<br/>
            * Nutzungsdaten<br/>
            * Meta-, Kommunikations- und Verfahrensdaten
          </p>
          <p>
            <strong>Kategorien betroffener Personen:</strong><br/>
            * Kommunikationspartner<br/>
            * Nutzer
          </p>
          <p>
            <strong>Zwecke der Verarbeitung:</strong><br/>
            * Kontaktanfragen und Kommunikation<br/>
            * Sicherheitsmaßnahmen<br/>
            * Verwaltung und Beantwortung von Anfragen<br/>
            * Feedback<br/>
            * Bereitstellung unseres Onlineangebotes und Nutzerfreundlichkeit<br/>
            * Informationstechnische Infrastruktur
          </p>
        </section>

        <section className="legal-section">
          <h2>Maßgebliche Rechtsgrundlagen</h2>
          <p>
            <strong>Maßgebliche Rechtsgrundlagen nach der DSGVO:</strong> Im Folgenden erhalten Sie eine Übersicht der Rechtsgrundlagen der DSGVO, auf deren Basis wir personenbezogene Daten verarbeiten. Bitte nehmen Sie zur Kenntnis, dass neben den Regelungen der DSGVO nationale Datenschutzvorgaben in Ihrem bzw. unserem Wohn- oder Sitzland gelten können. Sollten ferner im Einzelfall speziellere Rechtsgrundlagen maßgeblich sein, teilen wir Ihnen diese in der Datenschutzerklärung mit.
          </p>
          <ul>
            <li>Einwilligung (Art. 6 Abs. 1 S. 1 lit. a) DSGVO)</li>
            <li>Vertragserfüllung und vorvertragliche Anfragen (Art. 6 Abs. 1 S. 1 lit. b) DSGVO)</li>
            <li>Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO)</li>
          </ul>
          <p>
            <strong>Nationale Datenschutzregelungen in Deutschland:</strong> Zusätzlich zu den Datenschutzregelungen der DSGVO gelten nationale Regelungen zum Datenschutz in Deutschland. Hierzu gehört insbesondere das Gesetz zum Schutz vor Missbrauch personenbezogener Daten bei der Datenverarbeitung (Bundesdatenschutzgesetz – BDSG). Das BDSG enthält insbesondere Spezialregelungen zum Recht auf Auskunft, zum Recht auf Löschung, zum Widerspruchsrecht, zur Verarbeitung besonderer Kategorien personenbezogener Daten, zur Verarbeitung für andere Zwecke und zur Übermittlung sowie automatisierten Entscheidungsfindung im Einzelfall einschließlich Profiling. Ferner können Landesdatenschutzgesetze der einzelnen Bundesländer zur Anwendung gelangen.
          </p>
          <p>
            <strong>Hinweis auf Geltung DSGVO und Schweizer DSG:</strong> Diese Datenschutzhinweise dienen sowohl der Informationserteilung nach dem schweizerischen Bundesgesetz über den Datenschutz (Schweizer DSG) als auch nach der Datenschutzgrundverordnung (DSGVO). Aus diesem Grund bitten wir Sie zu beachten, dass aufgrund der breiteren räumlichen Anwendung und Verständlichkeit die Begriffe der DSGVO verwendet werden. Insbesondere statt der im Schweizer DSG verwendeten Begriffe „Bearbeitung" von „Personendaten", "überwiegendes Interesse" und "besonders schützenswerte Personendaten" werden die in der DSGVO verwendeten Begriffe „Verarbeitung" von „personenbezogenen Daten" sowie "berechtigtes Interesse" und "besondere Kategorien von Daten" verwendet. Die gesetzliche Bedeutung der Begriffe wird jedoch im Rahmen der Geltung des Schweizer DSG weiterhin nach dem Schweizer DSG bestimmt.
          </p>
        </section>

        <section className="legal-section">
          <h2>Sicherheitsmaßnahmen</h2>
          <p>
            Wir treffen nach Maßgabe der gesetzlichen Vorgaben geeignete technische und organisatorische Maßnahmen, um ein dem Risiko angemessenes Schutzniveau zu gewährleisten. Diese Maßnahmen umfassen insbesondere die Sicherung der Vertraulichkeit, Integrität und Verfügbarkeit von Daten.
          </p>
          <p>
            Zu den Maßnahmen gehören die Kontrolle des physischen und elektronischen Zugangs zu den Daten, die Sicherung der Verfügbarkeit und ihrer Trennung sowie die Einrichtung von Verfahren zur Wahrnehmung von Betroffenenrechten, Löschung von Daten und Reaktionen auf Gefährdungen der Daten.
          </p>
          <p>
            <strong>TLS/SSL-Verschlüsselung (https):</strong> Um die Daten der Benutzer zu schützen, verwenden wir TLS/SSL-Verschlüsselung. Diese gewährleistet die sichere Übertragung von Daten zwischen unserer Website und dem Browser des Nutzers.
          </p>
        </section>

        <section className="legal-section">
          <h2>Internationale Datentransfers</h2>
          <p>
            Sofern wir Daten in einem Drittland (außerhalb der EU oder des EWR) verarbeiten, erfolgt dies nur im Einklang mit den gesetzlichen Vorgaben.
          </p>
          <p>
            Datentransfers in Drittländer erfolgen nur, wenn das Datenschutzniveau durch einen Angemessenheitsbeschluss anerkannt wurde, durch Standardvertragsklauseln, ausdrückliche Einwilligung oder im Rahmen gesetzlich erforderlicher Übermittlungen.
          </p>
          <p>
            <strong>EU-US Trans-Atlantic Data Privacy Framework:</strong> Bestimmte Unternehmen in den USA bieten durch das Data Privacy Framework (DPF) ein anerkanntes Datenschutzniveau, das im Rahmen eines Angemessenheitsbeschlusses als sicher anerkannt wurde.
          </p>
          <p>
            <strong>Vereinigtes Königreich (KI-Inferenz im kostenlosen Modus):</strong> Das primär eingesetzte Modell des kostenlosen Modus wird von Nebius aus einem Rechenzentrum im Vereinigten Königreich bereitgestellt. Übermittelt werden der Text Ihrer Nachrichten und die Antwort des Modells, kein Name, keine Kontodaten und keine IP-Adresse. Das Vereinigte Königreich ist von der Europäischen Kommission als Land mit angemessenem Datenschutzniveau anerkannt (Angemessenheitsbeschluss nach Art. 45 DSGVO, am 19. Dezember 2025 verlängert und gültig bis zum 27. Dezember 2031). Diese Übermittlung bedarf daher keiner zusätzlichen Garantien. Sollte der Beschluss außer Kraft treten, gelten die Standardvertragsklauseln aus dem Auftragsverarbeitungsvertrag mit Nebius als Garantie. Das Ausweichmodell läuft in Finnland (EWR).
          </p>
        </section>

        <section className="legal-section">
          <h2>Rechte der betroffenen Personen</h2>
          <p>
            Ihnen stehen als Betroffene nach der DSGVO verschiedene Rechte zu, darunter:
          </p>
          <ul>
            <li><strong>Widerspruchsrecht (Art. 21 DSGVO):</strong> Sie haben das Recht, aus Gründen, die sich aus Ihrer besonderen Situation ergeben, gegen die Verarbeitung Ihrer Daten auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse) Widerspruch einzulegen. Dies betrifft insbesondere die Verarbeitung zu Sicherheits- und Rate-Limiting-Zwecken.</li>
            <li>Widerrufsrecht bei Einwilligungen</li>
            <li>Auskunftsrecht (Art. 15 DSGVO)</li>
            <li>Recht auf Berichtigung (Art. 16 DSGVO)</li>
            <li>Recht auf Löschung (Art. 17 DSGVO) und Einschränkung der Verarbeitung (Art. 18 DSGVO)</li>
            <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO)</li>
            <li>Beschwerde bei einer Aufsichtsbehörde (Art. 77 DSGVO)</li>
          </ul>
          <p>
            <strong>Löschung Ihrer Daten:</strong> Da alle Chat-Daten ausschließlich lokal auf Ihrem Gerät gespeichert werden (verschlüsselt in IndexedDB), können Sie diese jederzeit durch Löschen Ihrer Browserdaten vollständig entfernen. Eine serverseitige Löschung ist nicht erforderlich, da wir keine Chat-Inhalte serverseitig speichern.
          </p>
          <p>
            <strong>Zuständige Aufsichtsbehörde:</strong> Der Landesbeauftragte für den Datenschutz und die Informationsfreiheit Baden-Württemberg, Lautenschlagerstraße 20, 70173 Stuttgart, <a href="https://www.baden-wuerttemberg.datenschutz.de">www.baden-wuerttemberg.datenschutz.de</a>.
          </p>
        </section>

        <section className="legal-section">
          <h2>Einsatz von Cookies und lokale Speicherung</h2>
          <p>
            Wir verwenden KEINE Tracking-, Analyse- oder Marketing-Cookies. Die einzige Cookie-Nutzung erfolgt durch Cloudflare (__cf_bm, nach einer Sicherheitsprüfung auch cf_clearance), technisch notwendige Sicherheitscookies für Bot-Schutz und Firewall (§ 25 Abs. 2 Nr. 2 TDDDG). Diese Cookies werden automatisch von Cloudflare gesetzt und erfordern keine Einwilligung.
          </p>
        </section>

        <section className="legal-section">
          <h2>Bereitstellung des Onlineangebotes und Webhosting</h2>
          <p>
          Wir verarbeiten die Daten der Nutzer, um unsere Online-Dienste zur Verfügung zu stellen. Zu diesem Zweck verarbeiten wir die IP-Adresse des Nutzers, die notwendig ist, um die Inhalte und Funktionen unserer Online-Dienste an den Browser oder das Endgerät der Nutzer zu übermitteln.
          </p>
          <p>
            <strong>Verarbeitete Datenarten:</strong><br/>
            * Nutzungsdaten<br/>
          </p>
          <p>
            <strong>Betroffene Personen:</strong><br/>
            * Nutzer
          </p>
          <p>
            <strong>Rechtsgrundlagen:</strong><br/>
            * Berechtigte Interessen (Art. 6 Abs. 1 S. 1 lit. f) DSGVO)
          </p>
          <p>
            <strong>Webhosting:</strong> Die Website wird über Cloudflare Pages (Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, USA) als Content-Delivery-Netzwerk ausgeliefert. Cloudflare ist unter dem EU-US Data Privacy Framework (DPF) zertifiziert. Bei der Auslieferung der statischen Website-Dateien (HTML, CSS, JavaScript) werden IP-Adressen in Cloudflare Access Logs erfasst. Es werden keine Chat-Inhalte, Audio-Daten oder sonstige Nutzerdaten über Cloudflare Pages verarbeitet.
          </p>
          <p>
            <strong>Audio-Server:</strong> Für die Sprachverarbeitung (TTS/STT) betreiben wir eigene Server bei Hetzner Online GmbH, Industriestr. 25, 91710 Gunzenhausen, Deutschland. Standorte: Falkenstein und Nürnberg, Deutschland. Die Datenschutzerklärung von Hetzner: <a href="https://www.hetzner.com/legal/privacy-policy">https://www.hetzner.com/legal/privacy-policy</a>.
          </p>
          <p>
            Die Datenerhebung erfolgt auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO. Der Betreiber hat ein berechtigtes Interesse an der technisch fehlerfreien Darstellung und zuverlässigen Bereitstellung des Dienstes.
          </p>
        </section>

        <section className="legal-section">
          <h2>KI-gestützter Chat-Dienst</h2>
          <p>
            Unser Chat-Dienst nutzt künstliche Intelligenz (KI) zur Generierung von Bildungsinhalten. Dabei werden folgende Daten verarbeitet:
          </p>
          <p><strong>Verarbeitete Daten:</strong></p>
          <ul>
            <li>Ihre Chat-Eingaben zusammen mit dem bisherigen Gesprächsverlauf, den die App mit jeder Nachricht mitschickt, damit die Persönlichkeit im Zusammenhang antworten kann</li>
            <li>Technische Daten: IP-Adresse, Zeitpunkt und eine zufällige Browser-Kennung, die die App für das tägliche kostenlose Kontingent in Ihrem Browser speichert</li>
            <li>Spracheinstellung</li>
          </ul>
          <p><strong>Verarbeitungszweck:</strong> Bereitstellung des KI-gestützten Bildungsdienstes (Art. 6 Abs. 1 lit. b DSGVO, Vertragserfüllung).</p>
          <p><strong>Auftragsverarbeiter:</strong></p>
          <ul>
            <li>Nebius B.V. (Niederlande), Verarbeitung in uk-south1 (Vereinigtes Königreich) und eu-north1 (Finnland, EWR). Zweck: KI-Inferenz (Textgenerierung) im kostenlosen Modus. Das primär eingesetzte Modell antwortet aus dem Vereinigten Königreich. Das Ausweichmodell in Finnland antwortet, wenn das Tagesbudget des primären Modells aufgebraucht oder das Modell nicht erreichbar ist. Keine Datenaufbewahrung (Zero Data Retention aktiviert, von Nebius für unser gesamtes Organisationskonto und alle Regionen angewendet). Kein Training mit Nutzerdaten. Auftragsverarbeitungsvertrag in den Nebius-Nutzungsbedingungen integriert.</li>
            <li>Cloudflare, Inc. (USA), Verarbeitung überwiegend in Europa. Zweck: API-Proxy, Sicherheit (WAF, Bot-Schutz), Rate Limiting. Auftragsverarbeitungsvertrag im Cloudflare Dashboard abrufbar. EU Cloud Code of Conduct Compliance Mark.</li>
          </ul>
          <p><strong>Eigener Schlüssel (BYOK):</strong> Wenn Sie Ihren eigenen OpenRouter-Schlüssel hinterlegen, sendet Ihr Browser Ihre geschriebenen Nachrichten direkt an OpenRouter, Inc. (USA), unter Ihrem eigenen OpenRouter-Konto und dessen Bedingungen. Diese Nachrichten laufen nicht über unsere Server, und wir sind an diesem Austausch nicht beteiligt. Ihr Schlüssel wird nur in Ihrem Browser gespeichert, verschlüsselt. Solange der Schalter „Zero Data Retention“ an ist (Standard), bittet die App OpenRouter, nur an Anbieter weiterzuleiten, die keine Daten aufbewahren. Datenschutzrichtlinie von OpenRouter: <a href="https://openrouter.ai/privacy">https://openrouter.ai/privacy</a>.</p>
          <p><strong>Speicherdauer:</strong> Chat-Inhalte speichern wir nicht auf unseren Servern. Jede Nachricht läuft über unseren Server zum KI-Modell, die Antwort wird per Streaming an Ihren Browser übertragen. Unsere Server-Logs erfassen Fehler ohne Nachrichteninhalte. Um das tägliche kostenlose Kontingent durchzusetzen und den Dienst zu schützen, halten unsere Server die zufällige Browser-Kennung und die IP-Adresse oder einen mit geheimem Schlüssel gebildeten Hashwert davon höchstens 24 Stunden vor. Blockiert der Inhaltsfilter eine Nachricht, bewahren wir bis zu 90 Tage einen Sicherheitsvermerk ohne den Nachrichtentext auf: Zeitpunkt, Art der Blockierung, Persönlichkeit, Modus, Sprache und einen mit geheimem Schlüssel gebildeten Hashwert der IP-Adresse (pseudonymisiert). IP-Adressen gelangen nie in unsere Analytik.</p>
          <p><strong>Hinweis:</strong> Bitte geben Sie keine personenbezogenen Daten (Name, Adresse, Telefonnummer, E-Mail, Bankdaten) in den Chat ein.</p>
        </section>

        <section className="legal-section">
          <h2>Audio-Dienst (Sprachsynthese und Spracherkennung)</h2>
          <p>
            Für die Sprachausgabe (Text-to-Speech) und Spracheingabe (Speech-to-Text) nutzen wir selbst betriebene Server in Deutschland:
          </p>
          <ul>
            <li>Standort: Hetzner GEX130, Falkenstein und Nürnberg, Deutschland</li>
            <li>Sprache wird ausschließlich auf diesen Servern erzeugt und erkannt</li>
            <li>Für die Sprachausgabe wird der zu sprechende Text dorthin übertragen, zum Beispiel die Antwort einer Persönlichkeit oder eine Geschichte. Für die Spracheingabe wird Ihre Aufnahme dorthin übertragen und in Text umgewandelt.</li>
            <li>Beides läuft über unseren Audio-Proxy bei Cloudflare, der die Daten weiterleitet und nichts speichert</li>
            <li>Texte und Aufnahmen werden unmittelbar nach der Verarbeitung gelöscht. Ihre Stimme wird nicht aufgezeichnet oder gespeichert.</li>
            <li>Zum Schutz vor Missbrauch hält der Proxy einen mit geheimem Schlüssel gebildeten Hashwert Ihrer IP-Adresse bis zu 24 Stunden vor</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>Community-Zählung</h2>
          <p>
            Die Community-Seite in der App zeigt, wie viele Menschen mitmachen und wie groß ihre gemeinsame Stimmkraft ist. Wenn Sie die Community-Seite öffnen, erzeugt die App eine zufällige Kennung für diesen Browser, speichert sie in Ihrem Browser (localStorage) und sendet sie mit Ihrer Stimmkraft und der Zahl Ihrer abgeschlossenen Persönlichkeiten an unseren Server, damit jeder Browser nur einmal zählt. Unser Server bewahrt diese Werte unter einem mit geheimem Schlüssel gebildeten Hashwert der Kennung auf und löscht sie 12 Monate nach Ihrem letzten Besuch der Community-Seite.
          </p>
          <p>
            <strong>Rechtsgrundlage:</strong> Art. 6 Abs. 1 lit. f DSGVO, unser Interesse an einer fairen Zählung. Die Kennung auf Ihrem Endgerät ist für diese von Ihnen genutzte Funktion erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).
          </p>
        </section>

        <section className="legal-section">
          <h2>Minderjährige / Nutzer unter 16 Jahren</h2>
          <p>
            Gemäß Art. 8 DSGVO i.V.m. § 8 BDSG benötigen Personen unter 16 Jahren die Zustimmung eines Erziehungsberechtigten zur Nutzung des Chat-Dienstes, soweit personenbezogene Daten verarbeitet werden.
          </p>
          <p>Wir haben folgende Schutzmaßnahmen implementiert:</p>
          <ul>
            <li>Altersbestätigung vor der ersten Chat-Nutzung</li>
            <li>Hinweis auf Erfordernis der elterlichen Zustimmung</li>
            <li>Technische Inhaltssicherung (mehrschichtige Inhaltsfilterung)</li>
            <li>Jugendschutzbeauftragter benannt (siehe <a href="/impressum#jugendschutz">Impressum</a>)</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>Speicherung auf Ihrem Endgerät</h2>
          <p>
            Wir verwenden keine Tracking-, Analyse- oder Marketing-Cookies. Unsere Seiten und die App speichern Folgendes in Ihrem Browser.
          </p>
          <p>
            <strong>Technisch notwendig für eine Funktion, die Sie nutzen</strong> (§ 25 Abs. 2 Nr. 2 TDDDG, keine Einwilligung nötig):
          </p>
          <ul>
            <li>Ihre Gespräche und Ihr Fortschritt (IndexedDB, verschlüsselt mit AES-256-GCM, ausschließlich auf Ihrem Gerät) sowie der Zustand der App, etwa Lesefortschritt, gehörte Geschichten und bereits gesehene Hinweise (localStorage)</li>
            <li>Ihr eigener API-Schlüssel, wenn Sie BYOK nutzen (IndexedDB, verschlüsselt, ausschließlich auf Ihrem Gerät)</li>
            <li>Spracheinstellung (localStorage)</li>
            <li>Zustimmung zu den Nutzungsbedingungen und Altersbestätigung (localStorage)</li>
            <li>Eine zufällige Browser-Kennung für das tägliche kostenlose Kontingent, erzeugt, wenn Sie die App ohne eigenen Schlüssel öffnen (localStorage), und täglich erneuert</li>
            <li>Eine zufällige Kennung für die Community-Zählung, erzeugt, wenn Sie die Community-Seite öffnen (localStorage)</li>
            <li>Ihre Antwort auf die Frage zur Werbe-Messung, Ja oder Nein, mit Version und Datum, damit wir sie respektieren (localStorage) für 12 Monate</li>
            <li>Kurzlebige Daten für den aktuellen Tab (sessionStorage, beim Schließen des Tabs gelöscht): was Sie auf unseren Seiten vor dem Einstieg in die App gewählt haben (Persönlichkeit, Konzil, Kapitel, Frage), ob die Startseite Sie bereits in die App weitergeleitet hat, und bereits erstellte Zusammenfassungen</li>
            <li>Cloudflare-Sicherheitscookies: __cf_bm (Bot-Schutz, 30 Minuten) und nach einer Sicherheitsprüfung cf_clearance</li>
          </ul>
          <p>
            <strong>Nur mit Ihrer Einwilligung zur Werbe-Messung</strong> (§ 25 Abs. 1 TDDDG, siehe „Conversion-Messung“), im sessionStorage, gelöscht beim Schließen des Tabs oder mit dem Widerruf:
          </p>
          <ul>
            <li>Die Klick-Kennung der Anzeige</li>
            <li>Markierungen, die verhindern, dass ein Schritt doppelt an Google geht, sowie die gehörten Sekunden bis zum 30-Sekunden-Schritt</li>
          </ul>
          <p>
            Alle lokal gespeicherten Daten können Sie jederzeit durch Löschen Ihrer Browserdaten vollständig entfernen.
          </p>
        </section>

        <section className="legal-section">
          <h2>Auftragsverarbeiter</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--text-tertiary)' }}>Anbieter</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--text-tertiary)' }}>Zweck</th>
                <th style={{ textAlign: 'left', padding: '0.5rem', borderBottom: '1px solid var(--text-tertiary)' }}>Standort</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ padding: '0.5rem' }}>Cloudflare, Inc.</td>
                <td style={{ padding: '0.5rem' }}>CDN, WAF, API-Proxy, Bot-Schutz</td>
                <td style={{ padding: '0.5rem' }}>Edge (EU-priorisiert)</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem' }}>Nebius B.V.</td>
                <td style={{ padding: '0.5rem' }}>KI-Inferenz (kostenloser Modus)</td>
                <td style={{ padding: '0.5rem' }}>uk-south1 (Vereinigtes Königreich, primäres Modell) und eu-north1 (Finnland, EWR, Ausweichmodell)</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem' }}>Hetzner Online GmbH</td>
                <td style={{ padding: '0.5rem' }}>Audio-Server (TTS/STT)</td>
                <td style={{ padding: '0.5rem' }}>Falkenstein + Nürnberg, DE</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="legal-section">
          <h2>Bot-Schutz (Cloudflare Turnstile)</h2>
          <p>
            Zum Schutz vor automatisiertem Missbrauch nutzen wir Cloudflare Turnstile, einen Bot-Schutz-Dienst von Cloudflare, Inc. Dabei wird ein externes Skript von challenges.cloudflare.com geladen. Turnstile arbeitet im unsichtbaren Modus (kein CAPTCHA) und erzeugt ein Sicherheits-Token zur Verifizierung, dass die Anfrage von einem echten Nutzer stammt. Es werden keine personenbezogenen Daten an Cloudflare übermittelt, die über die technisch notwendige Verbindung hinausgehen.
          </p>
          <p>
            <strong>Rechtsgrundlage:</strong> Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) an der Sicherheit und Integrität des Dienstes.
          </p>
        </section>

        <section className="legal-section">
          <h2>Conversion-Messung (Google Ads, nur mit Einwilligung)</h2>
          <p>
            Wir schalten kostenlose Anzeigen über Googles Programm für gemeinnützige Organisationen (Google Ad Grants). Wenn Sie über eine dieser Anzeigen zu uns kommen, enthält die Webadresse eine von Google vergebene Klick-Kennung (gclid). Google kann sie Ihrem Klick und gegebenenfalls Ihrem Google-Konto zuordnen, daher behandeln wir sie als personenbezogenes Datum.
          </p>
          <p>
            Kommen Sie über eine solche Anzeige, fragen wir, ob wir Ihren Besuch für Google zählen dürfen. Die Frage ist freiwillig, und die ganze Bibliothek bleibt so oder so offen. Bis zu Ihrer Antwort bleibt die Klick-Kennung nur im Arbeitsspeicher der Seite und wird nicht gespeichert. Sagen Sie Nein, wird sie verworfen, und Ihr Browser merkt sich das Nein. Sagen Sie Ja, halten wir die Klick-Kennung in diesem Browser-Tab (sessionStorage), bis der Tab geschlossen wird, und Ihr Browser merkt sich das Ja (localStorage) für 12 Monate, damit auch spätere Besuche über unsere Anzeigen gezählt werden. Besucher unserer bezahlten Anzeigen (ihre Webadresse enthält p=1) werden nie gefragt, ihre Klick-Kennung wird sofort verworfen.
          </p>
          <p>
            Mit Ihrer Einwilligung sendet unser Server Google die Klick-Kennung bei jedem dieser Schritte: Ihr Ja auf die Frage, das Öffnen der App von einer unserer Seiten, die Zustimmung zu den Nutzungsbedingungen beim ersten Einstieg in die App, 30 Sekunden gehörtes Audio, die erste Nachricht an eine Persönlichkeit, die dritte Nachricht im selben Gespräch und die Nutzung eines Konzils. Mit jedem Schritt erhält Google die Klick-Kennung, den Schritt (als Conversion-Aktion), einen Wert und eine Währung, den Zeitpunkt, eine Auftragsnummer (Klick-Kennung plus Schritt, damit nichts doppelt zählt) und ein Einwilligungssignal (Nutzung zur Messung erlaubt, Nutzung für personalisierte Werbung nicht erlaubt). Google erhält weder die gewählte Persönlichkeit noch Ihr Land, keine Gesprächsinhalte und keine sonstigen Daten über Sie. Auf unseren Seiten läuft kein Skript und kein Pixel von Google. Die Übermittlung erfolgt von unserem Server an Google (Google Ads API).
          </p>
          <p>
            Empfänger ist Google (Google Ireland Limited sowie Google LLC, USA). Eine Übermittlung in die USA kann erfolgen. Google ist unter dem EU-US Data Privacy Framework zertifiziert. Wie Google Daten von Partnerseiten nutzt: <a href="https://business.safety.google/privacy">https://business.safety.google/privacy</a>.
          </p>
          <p>
            <strong>Speicherdauer:</strong> Die Klick-Kennung bewahren wir auf unseren Servern nicht auf. Für jeden gesendeten Schritt halten wir 90 Tage lang einen Vermerk ohne Klick-Kennung vor (den Schritt, gegebenenfalls die Persönlichkeit und den Zeitpunkt), um zu prüfen, ob die Zählung funktioniert. Die Speicherdauer bei Google richtet sich nach Googles Aufbewahrungsregeln für Werbedaten.
          </p>
          <p>
            <strong>Rechtsgrundlage und Widerruf:</strong> Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG). Sie können sie jederzeit mit Wirkung für die Zukunft widerrufen: über den Link „Werbe-Messung“ unten auf jeder Seite oder in der App unter Einstellungen › Rechtliches. Der Widerruf löscht die gespeicherte Klick-Kennung und vermerkt Ihr Nein. Danach wird nichts mehr gesendet.
          </p>
        </section>

        <section className="legal-section">
          <h2>Reichweitenmessung</h2>
          <p>
            Wir zählen, wie unsere Seiten und die App genutzt werden, ohne Cookies und ohne jemanden zu identifizieren. Wenn etwas geschieht, zum Beispiel eine Seite geöffnet, ein Chat begonnen oder eine Geschichte abgespielt wird, sendet die Seite eine kurze Zählmeldung an unseren Server. Jede Zählung ist eine Zeile mit wenigen groben Angaben, je nach Ereignis: was geschah (zum Beispiel „Chat begonnen“ oder „Geschichte beendet“), der Seitenpfad, die Persönlichkeit, der Modus oder das Kapitel, die Sprache (en oder de), das Land als zweistelliges Kürzel, das Cloudflare aus der Verbindung ableitet (zum Beispiel DE, oder XX, wenn unbekannt), die Geräteart (Smartphone, Tablet oder Desktop), wie lange unser Server für die Antwort brauchte, und bei einigen Schritten eine grobe Spanne statt einer genauen Zahl (zum Beispiel „1 bis 3 Minuten gehört“). Unsere Mess-Dokumentation listet jede Angabe auf.
          </p>
          <p>
            Beginnt ein Besuch, vermerkt die Zählung zusätzlich mit einem groben Stichwort, von welcher Art Ort der Besuch kam, zum Beispiel „Suche“, „Google-Anzeige“, „KI-Assistent“ oder „direkt“. Die Seite leitet das aus der Adresse der verlinkenden Seite ab, die Browser normalerweise mitsenden, und behält nur dieses Stichwort. Dasselbe Stichwort kann auch die Zählung des App-Einstiegs und des ersten Chats begleiten, wenn Sie über einen Link auf unseren Seiten in die App kommen.
          </p>
          <p>
            Keine Zählung enthält eine IP-Adresse, eine Nutzerkennung oder etwas, das Sie geschrieben haben. Wir bilden keine Profile und erkennen für die Zählung keinen Browser von einem Besuch zum nächsten wieder. Die Zählungen werden 90 Tage aufbewahrt.
          </p>
          <p>
            <strong>Rechtsgrundlage:</strong> Unser berechtigtes Interesse daran, zu wissen, ob unser gemeinnütziger Dienst funktioniert und wen er erreicht (Art. 6 Abs. 1 lit. f DSGVO). Die Zählungen tragen keine Kennung und lassen sich von uns keiner Person zuordnen, sie sind daher keine personenbezogenen Daten (Erwägungsgrund 26 DSGVO). Für die Zählung wird nichts auf Ihrem Endgerät gespeichert und nichts dort bereits Gespeichertes ausgelesen, deshalb holen wir dafür keine Einwilligung nach § 25 TDDDG ein. Was die App für ihre eigenen Funktionen auf Ihrem Endgerät speichert, steht im Abschnitt „Speicherung auf Ihrem Endgerät“.
          </p>
        </section>

        <section className="legal-section">
          <h2>Hinweis zu verwendeter Musik</h2>
          <p>
            Einige der auf dieser Webseite verwendeten Musikstücke wurden mit der KI-basierten Musikgenerationsplattform Udio erstellt. Die Musikdateien werden als statische Dateien von unseren Servern ausgeliefert. Es findet keine Datenübermittlung an Udio oder andere Dritte beim Abspielen statt. Weitere Musikstücke sind ordnungsgemäß lizenziert (siehe <a href="/impressum">Impressum</a> für Musik-Credits).
          </p>
        </section>

        <section className="legal-section">
          <h2>Streitschlichtung</h2>
          <p>
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>

        <div className="legal-footer">
          <div className="legal-links">
            <Link to="/cookie-policy" className="legal-link">
              {tNode('legal.links.cookiePolicy')}
            </Link>
            <span className="legal-separator">•</span>
            <Link to="/impressum" className="legal-link">
              {tNode('legal.links.imprint')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatenschutzPage;