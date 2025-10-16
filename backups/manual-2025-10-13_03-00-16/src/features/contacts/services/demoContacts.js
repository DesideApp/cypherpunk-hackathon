export const DEMO_CONTACTS_STATE = {
  confirmed: [
    {
      wallet: "vzwA8wheHMSaNnfL18TFn9Jq9BnTX5f8yj5E19vPX8j",
      nickname: "Alice",
      status: "confirmed",
      avatar: null,
    },
    {
      wallet: "2GeL1ka3YFskzkUoPNeJ1pnyG6Sfj2TxDsCWc6gC5vEE",
      nickname: "Bob",
      status: "confirmed",
      avatar: null,
    },
    {
      wallet: "Gwrn3UyMvrdSP8VsQZyTfAYp9qwrcu5ivBujKHufZJFZ",
      nickname: "Charlie",
      status: "confirmed",
      avatar: null,
    },
  ],
  pending: [],
  incoming: [],
};

const demoTimestamp = Date.parse("2025-01-15T12:00:00Z") || Date.now();

export const DEMO_PREVIEWS = DEMO_CONTACTS_STATE.confirmed.map((contact, index) => ({
  chatId: contact.wallet,
  displayName: contact.nickname,
  lastMessageText: index === 0 ? "Ready to sync the hackathon demo?" : index === 1 ? "Ping me if you need wallets." : "See you in the final presentation!",
  lastMessageTimestamp: demoTimestamp - index * 60_000,
}));
