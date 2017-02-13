import { Component, NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { platformBrowserDynamic } from "@angular/platform-browser-dynamic";
import { Router, RouterModule } from "@angular/router";
import { Store } from "@ngrx/store";
import { ROUTER_NAVIGATION, ROUTER_CANCEL, ROUTER_ERROR, StoreConnectedToRouter, connectToStore } from "../src/index";

describe('integration spec', () => {
  beforeEach(() => {
    document.body.appendChild(document.createElement("test-app"));
  });

  it('should work', (done) => {
    const ngModule = createNgModule(
      (state: string = "", action: any) => {
        if (action.type === ROUTER_NAVIGATION) {
          return action.payload.routerState.url.toString();
        } else {
          return state;
        }
      }
    );

    platformBrowserDynamic().bootstrapModule(ngModule).then(ref => {
      const router: Router = ref.injector.get(Router);
      const store = ref.injector.get(Store);
      const log = setUpLogging(router, store);

      router.navigateByUrl("/").then(() => {
        expect(log).toEqual([
          { type: 'store', state: "" }, //init event. has nothing to do with the router
          { type: 'router', event: 'NavigationStart', url: '/' },
          { type: 'router', event: 'RoutesRecognized', url: '/' },
          { type: 'store', state: "/" }, // ROUTER_NAVIGATION event in the store
          { type: 'router', event: 'NavigationEnd', url: '/' }
        ]);

      }).then(() => {
        log.splice(0);
        return router.navigateByUrl("next");

      }).then(() => {
        expect(log).toEqual([
          { type: 'router', event: 'NavigationStart', url: '/next' },
          { type: 'router', event: 'RoutesRecognized', url: '/next' },
          { type: 'store', state: "/next" },
          { type: 'router', event: 'NavigationEnd', url: '/next' }
        ]);

        done();
      });
    });
  });

  it("should support preventing navigation", (done) => {
    const ngModule = createNgModule(
      (state: string = "", action: any) => {
        if (action.type === ROUTER_NAVIGATION && action.payload.routerState.url.toString() === "/next") {
          throw new Error("You shall not pass!");
        } else {
          return state;
        }
      }
    );

    platformBrowserDynamic().bootstrapModule(ngModule).then(ref => {
      const router: Router = ref.injector.get(Router);
      const store = ref.injector.get(Store);
      const log = setUpLogging(router, store);

      router.navigateByUrl("/").then(() => {
        log.splice(0);
        return router.navigateByUrl("next");

      }).catch((e) => {
        expect(e.message).toEqual("You shall not pass!");
        expect(log).toEqual([
          { type: 'router', event: 'NavigationStart', url: '/next' },
          { type: 'router', event: 'RoutesRecognized', url: '/next' },
          { type: 'router', event: 'NavigationError', url: '/next' }
        ]);

        done();
      });
    });
  });

  it("should support rolling back if navigation gets canceled", (done) => {
    const reducer = (state: string = "", action: any):any => {
        if (action.type === ROUTER_NAVIGATION) {
          return {url: action.payload.routerState.url.toString(), lastAction: ROUTER_NAVIGATION};

        } else if (action.type === ROUTER_CANCEL) {
          return {url: action.payload.routerState.url.toString(), storeState: action.payload.storeState, lastAction: ROUTER_CANCEL};

        } else {
          return state;
        }
      };
    const canActivate = () => false;
    const ngModule = createNgModule(reducer, canActivate);

    platformBrowserDynamic().bootstrapModule(ngModule).then(ref => {
      const router: Router = ref.injector.get(Router);
      const store = ref.injector.get(Store);
      const log = setUpLogging(router, store);

      router.navigateByUrl("/").then(() => {
        log.splice(0);
        return router.navigateByUrl("next");

      }).then((r) => {
        expect(r).toEqual(false);

        expect(log).toEqual([
          { type: 'router', event: 'NavigationStart', url: '/next' },
          { type: 'router', event: 'RoutesRecognized', url: '/next' },
          { type: 'store', state: {url: '/next', lastAction: ROUTER_NAVIGATION} },
          { type: 'router', event: 'NavigationCancel', url: '/next' },
          { type: 'store', state: {url: '/next', lastAction: ROUTER_CANCEL, storeState: {reducer: {url: '/next', lastAction: ROUTER_NAVIGATION}} }}
        ]);

        done();
      });
    });
  });

  it("should support rolling back if navigation errors", (done) => {
    const reducer = (state: string = "", action: any):any => {
        if (action.type === ROUTER_NAVIGATION) {
          return {url: action.payload.routerState.url.toString(), lastAction: ROUTER_NAVIGATION};

        } else if (action.type === ROUTER_ERROR) {
          return {url: action.payload.routerState.url.toString(), storeState: action.payload.storeState, lastAction: ROUTER_ERROR};

        } else {
          return state;
        }
      };
    const canActivate = () => {throw new Error("BOOM!");};
    const ngModule = createNgModule(reducer, canActivate);

    platformBrowserDynamic().bootstrapModule(ngModule).then(ref => {
      const router: Router = ref.injector.get(Router);
      const store = ref.injector.get(Store);
      const log = setUpLogging(router, store);

      router.navigateByUrl("/").then(() => {
        log.splice(0);
        return router.navigateByUrl("next");

      }).catch((e) => {
        expect(e.message).toEqual("BOOM!");

        expect(log).toEqual([
          { type: 'router', event: 'NavigationStart', url: '/next' },
          { type: 'router', event: 'RoutesRecognized', url: '/next' },
          { type: 'store', state: {url: '/next', lastAction: ROUTER_NAVIGATION} },
          { type: 'router', event: 'NavigationError', url: '/next' },
          { type: 'store', state: {url: '/next', lastAction: ROUTER_ERROR, storeState: {reducer: {url: '/next', lastAction: ROUTER_NAVIGATION}} }}
        ]);

        done();
      });
    });
  });
});

function createNgModule(reducer: Function, canActivateNext: Function = () => true) {
  @Component({
    selector: 'test-app',
    template: '<router-outlet></router-outlet>'
  })
  class AppCmp {
  }

  @Component({
    selector: 'pagea-cmp',
    template: 'pagea-cmp'
  })
  class SimpleCmp { }

  @NgModule({
    declarations: [AppCmp, SimpleCmp],
    imports: [
      BrowserModule,
      StoreConnectedToRouter.provideStore({reducer}),
      RouterModule.forRoot(connectToStore([
        { path: '', component: SimpleCmp },
        { path: 'next', component: SimpleCmp, canActivate: ["CanActivateNext"] }
      ]), { useHash: true, initialNavigation: false })
    ],
    providers: [
      { provide: "CanActivateNext", useValue: canActivateNext }
    ],
    bootstrap: [AppCmp]
  })
  class TestAppModule {
  }

  return TestAppModule;
}

function setUpLogging(router: Router, store: Store<any>): any[] {
  const log = [];
  router.events.
    subscribe(e => log.push({ type: 'router', event: e.constructor.name, url: e.url.toString() }));
  store.subscribe(store => log.push({ type: 'store', state: store.reducer }));
  return log;
}