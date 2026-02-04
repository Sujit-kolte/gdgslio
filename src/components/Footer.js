import React from "react";
import Link from "next/link";
// Import the CSS Module
import styles from "./Footer.module.css";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.footerContainer}>
        {/* Brand / Logo Section */}
        <div className={styles.footerLogo}>
          <span>
            {/* Ensure logo.png is inside your 'public' folder */}
            <img src="/assests/logo.png" alt="GDG Logo" />
          </span>
          <span>
            <h1>On Campus &nbsp; &nbsp;</h1>
            <h2>
              {/* Removed invalid <ul> tag, kept styling logic */}
              <span>--- Smt. Kashibai Navle College of Engineering</span>
            </h2>
          </span>
        </div>

        {/* Info Section */}
        <div className={styles.footerInfo}>
          <p>&copy; {currentYear} All Rights Reserved</p>
          <a href="mailto:contact@gdgskncoe.com" className={styles.footerMail}>
            contact@gdgskncoe.com
          </a>
        </div>

        {/* Socials Section */}
        <div className={styles.navSocials}>
          <a href="#" target="_blank" rel="noopener noreferrer">
            <i className="fab fa-instagram"></i>
          </a>
          <a href="#" target="_blank" rel="noopener noreferrer">
            <i className="fab fa-linkedin"></i>
          </a>
          <a href="#" target="_blank" rel="noopener noreferrer">
            <i className="fab fa-github"></i>
          </a>
        </div>
      </div>

      {/* Footer Bottom */}
      <div className={styles.footerBottom}>
        <p>
          GDG-On Campus operates from Smt. Kashibai Navale College of
          Engineering, Pune, India.
          <br />
          Did you see our Terminal?
        </p>
      </div>
    </footer>
  );
}
