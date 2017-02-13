import {Injectable, ModuleWithProviders, NgModule, Optional} from "@angular/core";
import {
  ActivatedRouteSnapshot, CanActivateChild, ExtraOptions, RouterModule, RouterStateSnapshot,
  Routes, Router, NavigationCancel, RoutesRecognized, NavigationError
} from "@angular/router";
import {Store, StoreModule, provideStore} from "@ngrx/store";

/**
 * An action dispatched when the router navigates.
 */
export const ROUTER_NAVIGATION = 'ROUTER_NAVIGATION';

/**
 * Payload of ROUTER_NAVIGATION.
 */
export type RouterNavigationPayload = {
  routerState: RouterStateSnapshot,
  event: RoutesRecognized
}

/**
 * An action dispatched when the router cancel navigation.
 */
export const ROUTER_CANCEL = 'ROUTER_CANCEL';

/**
 * Payload of ROUTER_CANCEL.
 */
export type RouterCancelPayload<T> = {
  routerState: RouterStateSnapshot,
  storeState: T,
  event: NavigationCancel
};

/**
 * An action dispatched when the router errors.
 */
export const ROUTER_ERROR = 'ROUTE_ERROR';

/**
 * Payload of ROUTER_ERROR.
 */
export type RouterErrorPayload<T> = {
  routerState: RouterStateSnapshot,
  storeState: T,
  event: NavigationError
};

/**
 * Used to intercept all navigations to dispatch actions.
 *
 * @internal
 */
@Injectable()
export class CanActivateChild_Interceptor implements CanActivateChild {
  private routerState: RouterStateSnapshot = null;
  private storeState: any;
  private lastRoutesRecognized: RoutesRecognized;

  constructor(@Optional() private store: Store<any>, private router: Router) {
    if (!store) {
      throw new Error("RouterConnectedToStoreModule can only be used in combination with StoreModule");
    }
    this.setUpStateRollbackEvents();
  }

  canActivateChild(childRoute: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean {
    if (this.routerState !== state) {
      this.routerState = state;

      const payload = {routerState: state, event: this.lastRoutesRecognized};
      this.store.dispatch({ type: ROUTER_NAVIGATION, payload });
    }
    return true;
  }

  private setUpStateRollbackEvents(): void {
    this.store.subscribe(s => {
      this.storeState = s;
    });

    this.router.events.subscribe(e => {
      if (e instanceof RoutesRecognized) {
        this.lastRoutesRecognized = e;
      } else if (e instanceof NavigationCancel) {
        this.dispatchRouterCancel(e);
      } else if (e instanceof NavigationError) {
        this.dispatchRouterError(e);
      }
    });
  }

  private dispatchRouterCancel(event: NavigationCancel): void  {
    const payload = {routerState: this.routerState, storeState: this.storeState, event};
    this.store.dispatch({type: ROUTER_CANCEL, payload});
  }

  private dispatchRouterError(event: NavigationError): void  {
    const payload = {routerState: this.routerState, storeState: this.storeState, event};
    this.store.dispatch({type: ROUTER_ERROR, payload});
  }
}

/**
 * Wraps the router configuration to make StoreConnectedToRouter work.
 *
 * See StoreConnectedToRouter for more information.
 */
export function connectToStore(routes: Routes): Routes {
  return [{path: '', canActivateChild: [CanActivateChild_Interceptor], children: routes}];
}

/**
 * Sets up StoreModule and wires it up to the router.
 *
 * It has to be used in combination with connectToStore.
 *
 * Usage:
 *
 * ```typescript
 * @NgModule({
 *   declarations: [AppCmp, SimpleCmp],
 *   imports: [
 *     BrowserModule,
 *     RouterModule.forRoot(connectToStore([
 *       { path: '', component: SimpleCmp },
 *       { path: 'next', component: SimpleCmp }
 *     ])),
 *     StoreConnectedToRouter.provideStore(mapOfReducers)
 *   ],
 *   bootstrap: [AppCmp]
 * })
 * export class AppModule {
 * }
 * ```
 */
@NgModule({})
export class StoreConnectedToRouter {
  static provideStore(_reducer: any, _initialState?:any): ModuleWithProviders {
    return {
      ngModule: StoreModule,
      providers: [...provideStore(_reducer, _initialState), CanActivateChild_Interceptor]
    };
  }
}