import type { BaseWalletAdapter } from "@wallet-adapter/core/adapters/BaseWalletAdapter";
import { WalletListItem } from "@wallet-adapter/ui/components/WalletListItem";

type Props = {
  wallets: BaseWalletAdapter[];
  onConnect: (name: string) => void;
  disabled?: boolean;
  recentlyUsedName?: string;
};

export const UntrustedWalletList = ({
  wallets,
  onConnect,
  disabled = false,
  recentlyUsedName,
}: Props) => {
  if (!wallets?.length) return null;

  // Respetamos el orden que ya viene de Unified (recentlyUsed → pinned → A–Z)
  return (
    <ul
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        margin: 0,
        padding: 0,
        listStyle: "none",
      }}
    >
      {wallets.map((adapter) => {
        // Defensa por si upstream cambia las listas
        const installed = !!adapter.available;
        const mode = installed ? "connect" : "install";
        const statusLabel = installed ? "Installed" : "Install";

        const chips: string[] = [];
        if (adapter.name === "Phantom") chips.push("Most popular");
        if (adapter.name === recentlyUsedName) chips.push("Recently used");

        return (
          <li key={adapter.name}>
            <WalletListItem
              adapter={adapter}
              onConnect={onConnect}
              mode={mode}
              statusLabel={statusLabel}
              metaChips={chips}
              disabled={disabled}
            />
          </li>
        );
      })}
    </ul>
  );
};

export default UntrustedWalletList;
