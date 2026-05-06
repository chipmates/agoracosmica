import React, { FC, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CloseButton from '../components/Button/CloseButton';
import './LegalPages.css';
import { useTranslation } from '../hooks/useTranslation';

const ImpressumPage: FC = () => {
  const navigate = useNavigate();
  const { t, tNode } = useTranslation();

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
          <h1 className="legal-title">{tNode('legal.imprint.title')}</h1>
          <p className="legal-date">{tNode('legal.imprint.lastUpdated')}</p>
        </header>

       
        <section className="legal-section">
          <h2>Angaben gemäß § 5 DDG</h2>
          <p>
            ChipMates gemeinnützige GmbH<br/>
            Schusterstr. 50<br/>
            79098 Freiburg im Breisgau<br/>
            Deutschland
          </p>
        </section>

        <section className="legal-section">
          <h2>Vertreten durch</h2>
          <p>
            Michael Strasser
          </p>
        </section>

        <section className="legal-section">
          <h2>Kontakt</h2>
          <p>
            Telefon: 015679-203304<br/>
            E-Mail: <a href="mailto:chipmates@chipmates.ai">chipmates@chipmates.ai</a>
          </p>
        </section>

        <section className="legal-section">
          <h2>Registereintrag</h2>
          <p>
            Handelsregister Amtsgericht Freiburg<br/>
            Registernummer: HRB 728848
          </p>
        </section>

        <section className="legal-section">
          <h2>Umsatzsteuer-ID</h2>
          <p>
            Umsatzsteuer-Identifikationsnummer gemäß §27a Umsatzsteuergesetz: DE361995363
          </p>
        </section>

        <section className="legal-section">
          <h2>Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
          <p>
            Michael Strasser<br/>
            Schusterstr. 50<br/>
            79098 Freiburg im Breisgau
          </p>
        </section>

        <section className="legal-section" id="jugendschutz">
          <h2>Jugendschutzbeauftragter gemäß § 7 JMStV</h2>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '1.25rem' }}>
            <img
              src="/assets/images/jugendschutz-siegel.jpeg"
              alt="Jugendschutz-Siegel der IT-Recht Kanzlei"
              width={80}
              height={80}
              style={{ borderRadius: '50%', flexShrink: 0 }}
            />
            <p style={{ margin: 0 }}>
              Rechtsanwalt Jan Müller<br/>
              IT-Recht Kanzlei, München<br/>
              E-Mail: <a href="mailto:jugendschutzbeauftragter@it-recht-kanzlei.de">jugendschutzbeauftragter@it-recht-kanzlei.de</a>
            </p>
          </div>
        </section>

        <section className="legal-section">
          <h2>Hinweis zur künstlichen Intelligenz</h2>
          <p>
            Diese Plattform nutzt künstliche Intelligenz (KI) zur Generierung von Bildungsinhalten. Die Chat-Antworten werden von einem KI-Sprachmodell automatisch generiert. Alle KI-generierten Inhalte können Fehler enthalten und geben nicht die tatsächlichen Aussagen oder Meinungen der dargestellten historischen Persönlichkeiten wieder.
          </p>
        </section>

        <section className="legal-section">
          <h2>Online-Streitbeilegung</h2>
          <p>
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr/" target="_blank" rel="noopener noreferrer">https://ec.europa.eu/consumers/odr/</a>
          </p>
          <p>
            Wir sind weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>

        <section className="legal-section">
          <h2>Haftung für Inhalte</h2>
          <p>
            Die Inhalte unserer Seiten wurden mit größter Sorgfalt erstellt. Für die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir jedoch keine Gewähr übernehmen. Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend entfernen.
          </p>

          <h2>Haftung für Links</h2>
          <p>
            Unser Angebot enthält Links zu externen Webseiten Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft. Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Links umgehend entfernen.
          </p>

          <h2>Urheberrecht</h2>
          <p>
            Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung, Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite sind nur für den privaten, nicht kommerziellen Gebrauch gestattet. Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige Inhalte umgehend entfernen.
          </p>

          <h2>Musik-Credits</h2>
          <p>
            Hintergrundmusik: "Adrift Among Infinite Stars" von Scott Buckley – veröffentlicht unter CC-BY 4.0.<br />
            Für Podcast-Nutzung angepasst.<br />
            <a href="https://www.scottbuckley.com.au" target="_blank" rel="noopener noreferrer">www.scottbuckley.com.au</a>
          </p>
        </section>

        <div className="legal-footer">
          <div className="legal-links">
            <Link to="/datenschutz" className="legal-link">
              {tNode('legal.links.privacy')}
            </Link>
            <span className="legal-separator">•</span>
            <Link to="/cookie-policy" className="legal-link">
              {tNode('legal.links.cookiePolicy')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImpressumPage;