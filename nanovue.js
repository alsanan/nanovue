import { createApp } from 'https://unpkg.com/petite-vue?module';
//import { createApp } from './nanovue-org.js';
console.log(createApp)
export function nanoVue(ctx={}) {
  const app = createApp(ctx);

  // Directiva para cargar y montar contenido desde un archivo HTML
  async function loadOnClick(el, method = 'GET') {
    if (!['BUTTON', 'FORM'].includes(el.el.tagName)) return;
    const eventType = el.el.tagName === 'BUTTON' ? 'click' : 'submit';
    el.el.addEventListener(eventType, async event => {
      if (el.el.tagName === 'FORM') event.preventDefault();
      const targetSelector = el.el.getAttribute('v-target').replace(/\'/g, '');
      const response = await fetch(eval(el.exp), { method });
      const html = await response.text();
      const target = document.querySelector(targetSelector);
      target.innerHTML = html;
      createApp().mount(target);  // Montar en el target
    });
  }

  // Directiva para GET y POST
  app.directive('get', el => loadOnClick(el));
  app.directive('post', el => loadOnClick(el, 'POST'));

  // Directiva para cargar JSON y montar el template
  async function loadJson(el, method = 'GET') {
    if (!['BUTTON', 'FORM'].includes(el.el.tagName)) return;
    const eventType = el.el.tagName === 'BUTTON' ? 'click' : 'submit';
    el.el.addEventListener(eventType, async event => {
      if (el.el.tagName === 'FORM') event.preventDefault();
      const targetSelector = el.el.getAttribute('v-target').replace(/\'/g, '');
      const templateSelector = el.el.getAttribute('v-template').replace(/\'/g, '');
      const response = await fetch(eval(el.exp), { method });
      const jsonData = await response.json();
      const target = document.querySelector(targetSelector);
      const template = document.querySelector(templateSelector);
      if (template && target) {
        const templateClone = template.content.cloneNode(true);
        target.innerHTML = '';
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(templateClone);
        target.appendChild(tempDiv);
        createApp(jsonData).mount(tempDiv);
      }
    });
  }

  // Directivas para GET y POST JSON
  app.directive('get-json', el => loadJson(el));
  app.directive('post-json', el => loadJson(el, 'POST'));

  // Clase para cargar y definir componentes
  class ComponentLoader {
    constructor() {
      this.compos = {}; // Almacena componentes cargados
    }

    async loadAllComponents() {
      const nodes = document.querySelectorAll('*');
      const components = new Set(
        [...nodes].filter(node => 
          node.nodeType === Node.ELEMENT_NODE && node.tagName.includes('-')
        ).map(node => node.tagName.toLowerCase())
      );
      for (const compo of components) {
        await this.defineComponent(compo);
      }
    }

    async loadComponent(name) {
      const cacheKey = `component:${name}`;
      const cachedStatus = localStorage.getItem(cacheKey);
      try {
        if (cachedStatus !== 'js') {
          const htmlResponse = await fetch(`./${name}.html`);
          if (htmlResponse.ok) {
            localStorage.setItem(cacheKey, 'html');
            return await htmlResponse.text();
          }
          throw new Error('HTML not found');
        }
      } catch {}
      try {
        await import(`./${name}.js`);
        localStorage.setItem(cacheKey, 'js');
      } catch {
        localStorage.setItem(cacheKey, 'not-found');
      }
      return null;
    }

    async defineComponent(tagName) {
      if (this.compos[tagName]) return;

      const html = await this.loadComponent(tagName);
      if (!html) return;

      this.compos[tagName] = html;

      customElements.define(tagName, class extends HTMLElement {
        constructor() {
          super();
          this.attachTemplate(html);
        }

        attachTemplate(html) {
          const div = document.createElement('div');
          div.innerHTML = html;
          const template = div.querySelector('template');
          if (template) {
            const shadowRoot = this.attachShadow({ mode: 'open' });
            shadowRoot.appendChild(template.content.cloneNode(true));
          }
          const script = div.querySelector('script');
          if (script) {
            const scriptContent = script.textContent;
            new Function(scriptContent).call(this);
          }
          const style = div.querySelector('style');
          if (style) {
            const shadowStyle = document.createElement('style');
            shadowStyle.textContent = style.textContent;
            this.shadowRoot.appendChild(shadowStyle);
          }
        }
      });
    }
  }

  const loader = new ComponentLoader();
  loader.loadAllComponents();

  // Aplicar el comportamiento del scope por defecto si no está presente
  if (!document.querySelector('[v-scope], [-scope]')) {
    const body = document.querySelector('body');
    body.setAttribute('v-scope', '{defaultScope:true}');
  }

  return app;
}