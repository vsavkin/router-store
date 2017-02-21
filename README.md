# StoreConnectedToRouter

## Managing State

Managing state is a hard problem. We need to coordinate multiple backends, web workers, and UI components, all of which update the state concurrently. Patterns like Redux (e.g., `@ngrx/Store`) make some of this coordination explicit, but they don't solve the problem completely. It is much broader.


## State Synchronization

One of the problems we need to solve is syncing the client state with the URL.

### These are the problems we face:

* If the router needs some information from the store, it cannot reliably get it.
* If the store needs something from the router or the URL, it cannot reliably get it.
* If a router guard rejects navigation, the store state would be updated as if the navigation succeeded.
* The store/reducer cannot stop the navigation.
* The synchronization is ad-hoc. If we add a new route, we will have to reimplement the synchronization code there as well.

One way to fix it is to build a generic library synchronizing the store with the router (see ngrx/router-store). It won't solve all of the problems, but at least the synchronization won't be ad-hoc.

Another way is to make navigation part of updating the store. And finally we can make updating the store part of navigation.

Which one should we pick?

Since the user can always interact with the URL directly, we should treat the router as the source of truth and the initiator of actions. In other words, the router should invoke the reducer, not the other way around.

### Solution

So the router parses the URL and creates a router state snapshot. It then invokes the reducer with the snapshot, and only after the reducer is done it proceeds with the navigation.

This library is an implementation of this approach.

## How to use it

```typescript
import {connectToStore, StoreConnectedToRouter} from 'router-store';

@NgModule({
  declarations: [AppCmp, SimpleCmp],
  imports: [
    BrowserModule,
    RouterModule.forRoot(connectToStore([
      { path: '', component: SimpleCmp },
      { path: 'next', component: SimpleCmp }
    ])),
    StoreConnectedToRouter.provideStore(mapOfReducers)
  ],
  bootstrap: [AppCmp]
})
export class AppModule {
}
```

First, we need to wrap the routes by calling `connectToStore`. Second, instead of calling `StoreModule.provideStore`, we call `StoreConnectedToRouter.provideStore`.

During the navigation, the route will dispatch a ROUTER_NAVIGATION event with the following payload:

```typescript
export type RouterNavigationPayload = {
  routerState: RouterStateSnapshot,
  event: RoutesRecognized
}
```

This happens before the router runs any guards or resolvers. If the store reducer throws an exception, the navigation will be canceled.

Since the action is dispatched before any guards or resovlers run, they can use the updated state.

If a router guard rejects a navigation, a ROUTER_CANCEL action will be dispatched, so the state can be reset. The payload of this action has the following type:

```typescript
export type RouterCancelPayload<T> = {
  routerState: RouterStateSnapshot,
  storeState: T,
  event: NavigationCancel
};
```

`storeState` refers to the state before the canceled navigation started. So if you use immutable data, you can simply reset the state of the store to this value.

If the navigation results in an error, a ROUTER_ERROR action will be dispatched. The payload of this action has the following type:

```typescript
export type RouterErrorPayload<T> = {
  routerState: RouterStateSnapshot,
  storeState: T,
  event: NavigationError
};
```

## How does it compare to @ngrx/router-store?

See #[Comparison to Router-Store](./comparison-to-router-store.md) to compare this library with `@ngrx/router-store.`
