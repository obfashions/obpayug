/**
 * React Router compatibility layer backed by TanStack Router.
 *
 * The app was originally written against `react-router-dom`. This shim keeps
 * the familiar calling conventions (string paths, `navigate(-1)`,
 * `useSearchParams()`) while routing through TanStack Router.
 */
import * as React from "react";
import {
  Link as TanStackLink,
  useNavigate as useTanStackNavigate,
  useParams as useTanStackParams,
  useRouterState,
} from "@tanstack/react-router";

type AnyProps = Record<string, unknown>;

export interface LinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  to: string;
  replace?: boolean;
  state?: unknown;
  children?: React.ReactNode;
}

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(
  function Link({ to, replace, state, ...rest }, ref) {
    const isExternal = /^(https?:|mailto:|tel:|#)/.test(to);
    if (isExternal) {
      return <a ref={ref} href={to} {...rest} />;
    }
    const [pathname, hashAndSearch] = splitPath(to);
    const Comp = TanStackLink as unknown as React.ComponentType<AnyProps>;
    return (
      <Comp
        ref={ref}
        to={pathname}
        replace={replace}
        {...hashAndSearch}
        {...rest}
      />
    );
  },
);

export const NavLink = Link;

function splitPath(to: string) {
  let rest = to;
  let hash: string | undefined;
  let search: Record<string, string> | undefined;

  const hashIndex = rest.indexOf("#");
  if (hashIndex >= 0) {
    hash = rest.slice(hashIndex + 1);
    rest = rest.slice(0, hashIndex);
  }
  const searchIndex = rest.indexOf("?");
  if (searchIndex >= 0) {
    const params = new URLSearchParams(rest.slice(searchIndex + 1));
    search = Object.fromEntries(params.entries());
    rest = rest.slice(0, searchIndex);
  }
  return [rest || "/", { hash, search }] as const;
}

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export type NavigateFunction = (
  to: string | number,
  options?: NavigateOptions,
) => void;

export function useNavigate(): NavigateFunction {
  const navigate = useTanStackNavigate();
  return React.useCallback(
    (to: string | number, options?: NavigateOptions) => {
      if (typeof to === "number") {
        if (typeof window !== "undefined") window.history.go(to);
        return;
      }
      const [pathname, extras] = splitPath(to);
      void navigate({
        to: pathname,
        replace: options?.replace,
        ...extras,
      } as AnyProps as never);
    },
    [navigate],
  );
}

export function useParams<
  T extends Record<string, string | undefined> = Record<
    string,
    string | undefined
  >,
>(): T {
  return useTanStackParams({ strict: false }) as T;
}

export function useLocation() {
  // Select primitives only — returning a fresh object from `select` on every
  // render makes consumers re-render in a loop.
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const hash = useRouterState({ select: (s) => s.location.hash });

  return React.useMemo(
    () => ({
      pathname,
      search: searchStr ? `?${searchStr}` : "",
      hash: hash ? `#${hash}` : "",
      state: undefined as unknown,
    }),
    [pathname, searchStr, hash],
  );
}


export function useSearchParams(): [
  URLSearchParams,
  (next: URLSearchParams | Record<string, string>, options?: NavigateOptions) => void,
] {
  const searchStr = useRouterState({ select: (s) => s.location.searchStr });
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useTanStackNavigate();

  const params = React.useMemo(
    () => new URLSearchParams(searchStr ?? ""),
    [searchStr],
  );

  const setParams = React.useCallback(
    (
      next: URLSearchParams | Record<string, string>,
      options?: NavigateOptions,
    ) => {
      const entries =
        next instanceof URLSearchParams
          ? Object.fromEntries(next.entries())
          : next;
      void navigate({
        to: pathname,
        search: entries,
        replace: options?.replace,
      } as AnyProps as never);
    },
    [navigate, pathname],
  );

  return [params, setParams];
}
