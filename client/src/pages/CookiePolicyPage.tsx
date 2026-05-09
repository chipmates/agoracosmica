import { FC, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import CloseButton from '../components/Button/CloseButton';
import './LegalPages.css';
import { useTranslation } from '../hooks/useTranslation';

const CookiePolicyPage: FC = () => {
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
          <h1 className="legal-title">{tNode('legal.cookiePolicy.title')}</h1>
          <p className="legal-date">{tNode('legal.cookiePolicy.lastUpdated')}</p>
        </header>

        <section className="legal-section">
          <p className="legal-intro">
            {tNode('legal.cookiePolicy.intro')}
          </p>
        </section>

        <section className="legal-section">
          <h2>{tNode('legal.cookiePolicy.whatAreCookies.title')}</h2>
          <p>{tNode('legal.cookiePolicy.whatAreCookies.description')}</p>
        </section>

        <section className="legal-section">
          <h2>{tNode('legal.cookiePolicy.cookieFreeApproach.title')}</h2>
          <p className="legal-highlight">
            {tNode('legal.cookiePolicy.cookieFreeApproach.description')}
          </p>
        </section>

        <section className="legal-section">
          <h2>{tNode('legal.cookiePolicy.essentialStorage.title')}</h2>
          <p>{tNode('legal.cookiePolicy.essentialStorage.description')}</p>

          <table className="legal-table">
            <thead>
              <tr>
                <th>{tNode('legal.cookiePolicy.essentialStorage.table.type')}</th>
                <th>{tNode('legal.cookiePolicy.essentialStorage.table.purpose')}</th>
                <th>{tNode('legal.cookiePolicy.essentialStorage.table.duration')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{tNode('legal.cookiePolicy.essentialStorage.sessionStorage')}</td>
                <td>{tNode('legal.cookiePolicy.essentialStorage.sessionPurpose')}</td>
                <td>{tNode('legal.cookiePolicy.essentialStorage.sessionDuration')}</td>
              </tr>
              <tr>
                <td>{tNode('legal.cookiePolicy.essentialStorage.localStorage')}</td>
                <td>{tNode('legal.cookiePolicy.essentialStorage.localPurpose')}</td>
                <td>{tNode('legal.cookiePolicy.essentialStorage.localDuration')}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="legal-section">
          <h2>{tNode('legal.cookiePolicy.securityCookie.title')}</h2>
          <p>{tNode('legal.cookiePolicy.securityCookie.description')}</p>

          <table className="legal-table">
            <thead>
              <tr>
                <th>{tNode('legal.cookiePolicy.securityCookie.table.name')}</th>
                <th>{tNode('legal.cookiePolicy.securityCookie.table.purpose')}</th>
                <th>{tNode('legal.cookiePolicy.securityCookie.table.duration')}</th>
                <th>{tNode('legal.cookiePolicy.securityCookie.table.legalBasis')}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>{tNode('legal.cookiePolicy.securityCookie.name')}</code></td>
                <td>{tNode('legal.cookiePolicy.securityCookie.purpose')}</td>
                <td>{tNode('legal.cookiePolicy.securityCookie.duration')}</td>
                <td>{tNode('legal.cookiePolicy.securityCookie.legalBasis')}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="legal-section">
          <h2>{tNode('legal.cookiePolicy.whatWeDontUse.title')}</h2>
          <p>{tNode('legal.cookiePolicy.whatWeDontUse.description')}</p>
          <ul>
            <li>{tNode('legal.cookiePolicy.whatWeDontUse.analytics')}</li>
            <li>{tNode('legal.cookiePolicy.whatWeDontUse.marketing')}</li>
            <li>{tNode('legal.cookiePolicy.whatWeDontUse.social')}</li>
            <li>{tNode('legal.cookiePolicy.whatWeDontUse.thirdParty')}</li>
            <li>{tNode('legal.cookiePolicy.whatWeDontUse.tracking')}</li>
          </ul>
        </section>

        <section className="legal-section">
          <h2>{tNode('legal.cookiePolicy.privacyRights.title')}</h2>
          <p>{tNode('legal.cookiePolicy.privacyRights.description')}</p>
        </section>

        <section className="legal-section">
          <h2>{tNode('legal.cookiePolicy.privacyAnalytics.title')}</h2>
          <p>{tNode('legal.cookiePolicy.privacyAnalytics.description')}</p>
        </section>

        <section className="legal-section">
          <h2>{tNode('legal.cookiePolicy.changes.title')}</h2>
          <p>{tNode('legal.cookiePolicy.changes.description')}</p>
        </section>

        <section className="legal-section">
          <h2>{tNode('legal.cookiePolicy.contact.title')}</h2>
          <p>{tNode('legal.cookiePolicy.contact.description')}</p>
        </section>

        <div className="legal-footer">
          <div className="legal-links">
            <Link to="/datenschutz" className="legal-link">
              {tNode('legal.links.privacy')}
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

export default CookiePolicyPage;