// Kontaktangaben an einer Stelle (Footer, später Impressum u. a.).
export const MAIL_ANFRAGE = 'anfrage@selbst-gemacht.eu';
export const BETREFF_ANFRAGE = 'Anfrage an das Team von SELBSTGEMACHT';
/** mailto-Link mit vorausgefülltem Betreff */
export const mailtoAnfrage = `mailto:${MAIL_ANFRAGE}?subject=${encodeURIComponent(BETREFF_ANFRAGE)}`;

// Telefon und WhatsApp Business: dieselbe Nummer (20.11.2026)
export const TELEFON_ANZEIGE = '037431 86959';
export const TELEFON_LINK = 'tel:+493743186959';
export const WHATSAPP_LINK = 'https://wa.me/493743186959';
