// Kontaktangaben an einer Stelle (Footer, später Impressum u. a.).
export const MAIL_ANFRAGE = 'anfrage@selbst-gemacht.eu';
export const BETREFF_ANFRAGE = 'Anfrage an das Team von SELBSTGEMACHT';
/** mailto-Link mit vorausgefülltem Betreff */
export const mailtoAnfrage = `mailto:${MAIL_ANFRAGE}?subject=${encodeURIComponent(BETREFF_ANFRAGE)}`;
