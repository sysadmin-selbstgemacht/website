// Kontaktangaben an einer Stelle (Footer, später Impressum u. a.).
export const MAIL_ANFRAGE = 'anfrage@selbst-gemacht.eu';
export const BETREFF_ANFRAGE = 'Anfrage an das Team von SELBSTGEMACHT';
/** mailto-Link mit vorausgefülltem Betreff */
export const mailtoAnfrage = `mailto:${MAIL_ANFRAGE}?subject=${encodeURIComponent(BETREFF_ANFRAGE)}`;

// Telefon und WhatsApp Business: dieselbe Nummer (20.11.2026)
export const TELEFON_ANZEIGE = '037431 86959';
export const TELEFON_LINK = 'tel:+493743186959';
export const WHATSAPP_LINK = 'https://wa.me/493743186959';

export const HAUS_NAME = 'SELBSTGEMACHT';
export const HAUS_ZUSATZ = 'Seminar- und Gästehaus';
export const ADRESSE = 'Arnsgrün 56, 07937 Zeulenroda-Triebes';
export const ROUTE_LINK = 'https://www.google.com/maps/dir/?api=1&destination=Arnsgr%C3%BCn+56%2C+07937+Zeulenroda-Triebes';

// Factsheet (A4, aus dem Design-Canvas), Social-Media-Profile des Hauses (21.11.)
export const FACTSHEET_LINK: string | null = '/unterlagen/selbstgemacht-factsheet.pdf';
export const FACEBOOK_LINK: string | null = 'https://www.facebook.com/share/1CB6Hp8cSH/';
export const INSTAGRAM_LINK: string | null = 'https://www.instagram.com/selbstgemacht.eu/'; // ohne Teilen-Kennung (?dmpr=…)
