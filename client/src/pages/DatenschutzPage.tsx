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
          <p>Stand: 8. April 2026</p>
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
            * Bot-Schutz (Cloudflare Turnstile)<br/>
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
            Wir verwenden KEINE Tracking-, Analyse- oder Marketing-Cookies. Die einzige Cookie-Nutzung erfolgt durch Cloudflare (__cf_bm), einen technisch notwendigen Sicherheitscookie für Bot-Schutz und Firewall (§ 25 Abs. 2 Nr. 2 TDDDG). Dieser Cookie wird automatisch von Cloudflare gesetzt und erfordert keine Einwilligung.
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
            <li>Ihre Chat-Eingaben (Textnachrichten an den KI-Assistenten)</li>
            <li>Technische Daten (IP-Adresse gehasht, Zeitstempel, Browser-Kennung)</li>
            <li>Spracheinstellung</li>
          </ul>
          <p><strong>Verarbeitungszweck:</strong> Bereitstellung des KI-gestützten Bildungsdienstes (Art. 6 Abs. 1 lit. b DSGVO, Vertragserfüllung).</p>
          <p><strong>Auftragsverarbeiter:</strong></p>
          <ul>
            <li>Nebius B.V. (Niederlande), Verarbeitung in eu-north1 (Finnland, EWR). Zweck: KI-Inferenz (Textgenerierung) im kostenlosen Modus. Keine Datenaufbewahrung (Zero Data Retention aktiviert). Kein Training mit Nutzerdaten. Auftragsverarbeitungsvertrag in den Nebius-Nutzungsbedingungen integriert.</li>
            <li>OpenRouter, Inc. (USA). Zweck: API-Routing für KI-Inferenz im BYOK-Modus (Bring Your Own Key). Nutzer stellen ihren eigenen API-Schlüssel bereit, der ausschließlich lokal im Browser gespeichert wird. OpenRouter leitet Anfragen an den gewählten KI-Anbieter weiter. Datenschutzrichtlinie: <a href="https://openrouter.ai/privacy">https://openrouter.ai/privacy</a>.</li>
            <li>Cloudflare, Inc. (USA), Verarbeitung überwiegend in Europa. Zweck: API-Proxy, Sicherheit (WAF, Bot-Schutz), Rate Limiting. Auftragsverarbeitungsvertrag im Cloudflare Dashboard abrufbar. EU Cloud Code of Conduct Compliance Mark.</li>
          </ul>
          <p><strong>Speicherdauer:</strong> Chat-Inhalte werden serverseitig NICHT gespeichert. KI-Antworten werden per Streaming direkt an Ihren Browser übertragen. Sicherheitslogs (nur bei Blockierung durch Inhaltsfilter) werden bis zu 90 Tage anonymisiert aufbewahrt (IP gehasht). Rate-Limit-Zähler werden 24 Stunden gespeichert (IP gehasht).</p>
          <p><strong>Hinweis:</strong> Bitte geben Sie keine personenbezogenen Daten (Name, Adresse, Telefonnummer, E-Mail, Bankdaten) in den Chat ein.</p>
        </section>

        <section className="legal-section">
          <h2>Audio-Dienst (Sprachsynthese und Spracherkennung)</h2>
          <p>
            Für die Sprachausgabe (Text-to-Speech) und Spracheingabe (Speech-to-Text) nutzen wir selbst betriebene Server in Deutschland:
          </p>
          <ul>
            <li>Standort: Hetzner GEX130, Falkenstein und Nürnberg, Deutschland</li>
            <li>Datenverarbeitung ausschließlich in Deutschland</li>
            <li>Sprachdaten werden zur Verarbeitung übertragen und unmittelbar nach der Konvertierung gelöscht</li>
            <li>Keine Aufzeichnung von Sprachaufnahmen</li>
            <li>Audio-Daten werden direkt vom Browser an die Hetzner-Server übertragen (kein Drittanbieter beteiligt)</li>
          </ul>
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
          <h2>Technisch notwendige Speicherung</h2>
          <p>
            Wir verwenden KEINE Tracking-, Analyse- oder Marketing-Cookies. Folgende technisch notwendige Speicherungen erfolgen auf Ihrem Gerät (§ 25 Abs. 2 Nr. 2 TDDDG):
          </p>
          <ul>
            <li>Chat-Verlauf und Konversationen (IndexedDB, verschlüsselt mit AES-256-GCM, ausschließlich lokal auf Ihrem Gerät)</li>
            <li>Spracheinstellung (localStorage)</li>
            <li>Zustimmung zu den Nutzungsbedingungen (localStorage)</li>
            <li>Altersbestätigung (localStorage)</li>
            <li>Sitzungsdaten (sessionStorage, bei Schließen des Tabs gelöscht)</li>
            <li>Cloudflare-Sicherheitscookies (__cf_bm): Technisch notwendig für Bot-Schutz und WAF</li>
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
                <td style={{ padding: '0.5rem' }}>eu-north1, Finnland (EWR)</td>
              </tr>
              <tr>
                <td style={{ padding: '0.5rem' }}>OpenRouter, Inc.</td>
                <td style={{ padding: '0.5rem' }}>KI-Inferenz (BYOK-Modus)</td>
                <td style={{ padding: '0.5rem' }}>USA (je nach gewähltem Modell)</td>
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
            Wenn Sie über eine Google-Werbeanzeige auf unsere Website gelangen, enthält die URL einen Klick-Identifikator (gclid). Der gclid ist eine von Google vergebene Kennung pro Klick. Da Google ihn Ihrem Klick und gegebenenfalls Ihrem Google-Konto zuordnen kann, behandeln wir ihn als personenbezogenes Datum, nicht als anonyme Kennung.
          </p>
          <p>
            Der gclid wird im sessionStorage Ihres Browsers gespeichert (kein Cookie). Er ist an den Browser-Tab gebunden. Eine Übermittlung an Google findet ausschließlich dann statt, wenn Sie hierzu Ihre ausdrückliche Einwilligung erteilen. Diese Einwilligung wird nur Besuchern angeboten, die über eine Google-Anzeige kommen, und ist optional. Ohne Einwilligung wird nichts an Google übermittelt.
          </p>
          <p>
            Mit Ihrer Einwilligung übermitteln wir den gclid bei bestimmten Ereignissen (Beginn der Erkundung der Bibliothek, Profilerstellung, Auswahl eines Lernmodus, Nutzung eines Konzils) serverseitig über die Google Ads Conversion API, damit die Anzeige einer Conversion zugeordnet werden kann (kein JavaScript-Tracker, kein Pixel auf der Website). Übermittelt werden: der gclid, das ausgelöste Ereignis (als Conversion-Aktion), ein Wert, eine Währung, ein Zeitstempel und eine Order-ID (gclid plus Ereignis, zur Deduplizierung). Weder die gewählte Persönlichkeit noch Ihr Länder-Kürzel, keine Gesprächsinhalte und keine sonstigen personenbezogenen Daten werden übermittelt. Auf unseren Systemen speichern wir den gclid nicht dauerhaft.
          </p>
          <p>
            Empfänger ist Google (Google Ireland Limited sowie Google LLC, USA). Eine Übermittlung in die USA kann erfolgen. Google ist unter dem EU-US Data Privacy Framework zertifiziert.
          </p>
          <p>
            <strong>Rechtsgrundlage:</strong> Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO und § 25 Abs. 1 TDDDG). Sie können Ihre Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen, in den Einstellungen unter „Datenschutz" über „Einwilligung zur Werbe-Messung widerrufen". Der Widerruf löscht den gespeicherten gclid.
          </p>
        </section>

        <section className="legal-section">
          <h2>Reichweitenmessung</h2>
          <p>
            Wir messen pro serverseitig gezählter Aktivität (zum Beispiel ein gestarteter Chat, eine begonnene oder abgeschlossene Inhalts-Wiedergabe einer Geschichte, Lehre, eines Prismas oder Konzils, ein Seitenaufruf) einen anonymen Zähler. Erfasst werden ausschließlich strukturelle Etiketten: der genutzte Endpunkt, die ausgewählte Persönlichkeit, der gewählte Modus, die Sprache (en oder de) und das vom Cloudflare-Edge ermittelte Länder-Kürzel (zweistelliger ISO-Code, zum Beispiel DE oder XX bei Unbekannt). Es werden keine IP-Adressen in Analyse-Datensätzen gespeichert, keine Nutzer-Profile gebildet, keine Cookies gesetzt, kein Quell- oder Kanal-Etikett hinterlegt. Es findet keine Wiedererkennung über Sitzungen hinweg statt.
          </p>
          <p>
            <strong>Rechtsgrundlage:</strong> Berechtigtes Interesse (Art. 6 Abs. 1 lit. f DSGVO) an der Messung der Wirksamkeit unserer gemeinnützigen Öffentlichkeitsarbeit. Die rein aggregierte, anonyme Messung liegt unterhalb der Schwelle personenbezogener Daten gemäß Erwägungsgrund 26 DSGVO. § 25 TDDDG ist auf diese Messung nicht einschlägig, da im Rahmen der Zählung keine Speicherung oder Auslesung von Informationen auf Ihrem Endgerät stattfindet. Die für den Betrieb der App technisch notwendige lokale Speicherung (zum Beispiel Spracheinstellung, Sitzungs-UUID für Ratelimiting) ist gemäß § 25 Abs. 2 TDDDG ausgenommen.
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