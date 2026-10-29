export const chatDictionary = {
  join: {
    title: 'Entre no chat',
    subtitle: 'Digite como quer ser chamado e comece a conversar.',
    name: 'Seu nome',
    nameHint: 'Entre 2 e 20 caracteres.',
    submit: 'Entrar no chat',
    submitting: 'Entrando…',
    help: 'Sem cadastro e sem senha. Seu nome aparece para todos na sala.',
  },
  room: {
    title: 'Sala geral',
    leave: 'Sair',
    messages: 'Mensagens',
    empty: 'Nenhuma mensagem ainda. Diga oi!',
    you: 'Você',
    loadError: 'Não foi possível carregar a sala',
    retry: 'Tentar novamente',
    newMessages: 'Novas mensagens ↓',
    loadOlder: 'Carregar mensagens anteriores',
    loadingOlder: 'Carregando…',
  },
  composer: {
    label: 'Mensagem',
    placeholder: 'Escreva uma mensagem…',
    send: 'Enviar',
  },
  message: {
    sending: 'Enviando…',
    failed: 'Não enviada',
    retry: 'Tentar de novo',
  },
  theme: {
    toDark: 'Usar tema escuro',
    toLight: 'Usar tema claro',
  },
  online: (count: number) =>
    count === 1 ? '1 pessoa online' : `${count} pessoas online`,
  typing: (names: readonly string[]) => {
    if (names.length === 1) return `${names[0]} está digitando…`;
    if (names.length === 2) return `${names[0]} e ${names[1]} estão digitando…`;
    return 'Várias pessoas estão digitando…';
  },
  system: {
    joined: (name: string) => `${name} entrou no chat`,
    left: (name: string) => `${name} saiu do chat`,
  },
  errors: {
    nameTaken: 'Esse nome já está em uso na sala.',
    nameInvalid:
      'O nome deve ter de 2 a 20 caracteres: letras, números, espaço, ".", "_" ou "-".',
    joinFailed: 'Não foi possível entrar no chat. Tente de novo.',
    rateLimited:
      'Você está enviando mensagens rápido demais. Aguarde alguns segundos.',
    messageTooLong: 'A mensagem pode ter no máximo 1000 caracteres.',
    reconnecting: 'Reconectando…',
    loadOlderFailed: 'Não foi possível carregar as mensagens anteriores.',
  },
} as const;
