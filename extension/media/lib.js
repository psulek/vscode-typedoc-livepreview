const element = document.querySelectorAll('a[name]');

element.forEach(el => {
  el.setAttribute('id', el.getAttribute('name')); 
});

hljs.highlightAll();