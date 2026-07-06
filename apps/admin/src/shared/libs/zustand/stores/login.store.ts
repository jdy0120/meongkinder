import { createStore } from "zustand/vanilla";
import { persist, createJSONStorage } from "zustand/middleware";

export type LoginState = {
  accessToken: string;
};

export type LoginActions = {
  setAccessToken: (accessToken: string) => void;
};

export type LoginStore = LoginState & LoginActions;

export const defaultInitState: LoginState = {
  accessToken: "",
};

export const createLoginStore = (initState: LoginState = defaultInitState) => {
  return createStore<LoginStore>()(
    persist(
      (set) => ({
        ...initState,
        setAccessToken: (accessToken) => set(() => ({ accessToken })),
      }),
      {
        name: "login",
        storage: createJSONStorage(() => sessionStorage),
      },
    ),
  );
};
