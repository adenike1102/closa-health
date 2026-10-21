// Shows text with any phone number (like 0809 111 6264) as a tap-to-call link.
const PHONE = /(0\d{3} \d{3} \d{4})/g;

export default function PhoneText({ text }) {
  return text.split(PHONE).map((part, i) =>
    i % 2 ? <a key={i} href={'tel:' + part.replace(/ /g, '')}>{part}</a> : part
  );
}
