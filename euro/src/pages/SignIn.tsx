import { useState } from "react";
import { KeyRound } from "lucide-react";
import { useEuro } from "../store/store";
import { Btn, useToast } from "../ui/kit";

export default function SignIn() {
  const { state, signIn } = useEuro();
  const { toast } = useToast();
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pin, setPin] = useState("");

  const enter = (userId: string, pinValue?: string) => {
    const err = signIn(userId, pinValue);
    if (err) toast(err, "err");
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center px-6 py-10">
      <div className="mb-1 font-grotesk text-4xl font-extrabold tracking-tight text-white">
        BARNITO<span className="text-volt-400">28</span>
      </div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-ink-400">Euro 2028 · UK & Ireland</div>
      <p className="mb-8 max-w-sm text-center text-sm text-ink-300">
        Back your calls, freeze your odds, bank the points.
        <span className="text-punch-300"> The unlikelier your pick, the more it pays.</span>
      </p>

      <div className="grid w-full grid-cols-2 gap-2.5">
        {state.users.map((u) => (
          <div key={u.id}>
            <button
              onClick={() => (u.pin ? setPinFor(pinFor === u.id ? null : u.id) : enter(u.id))}
              className={`e-card e-card-hover flex w-full items-center gap-2.5 p-3.5 text-left ${pinFor === u.id ? "ring-volt-400/40" : ""}`}
            >
              <span className="text-2xl">{u.emoji}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-white">{u.name}</span>
                <span className="text-[11px] text-ink-400">{u.isAdmin ? "Admin · PIN" : "Tap to sign in"}</span>
              </span>
            </button>
            {pinFor === u.id && (
              <form
                className="mt-2 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  enter(u.id, pin);
                }}
              >
                <input
                  autoFocus
                  inputMode="numeric"
                  type="password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  placeholder="PIN"
                  className="e-input"
                />
                <Btn variant="primary" size="md" type="submit">
                  <KeyRound size={14} /> Go
                </Btn>
              </form>
            )}
          </div>
        ))}
      </div>

      <p className="mt-8 text-center text-[11px] text-ink-500">
        Mock sign-in — accounts are open, this is a friends game. Odds and results are simulated.
      </p>
    </div>
  );
}
