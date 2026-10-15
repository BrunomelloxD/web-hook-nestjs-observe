// Fixed time zone: server and browser must print the same text (no hydration mismatch).
const timeFormat = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'America/Sao_Paulo',
});

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}
