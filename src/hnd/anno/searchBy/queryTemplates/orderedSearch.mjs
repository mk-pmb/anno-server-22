// -*- coding: utf-8, tab-width: 2 -*-

function defaultSearchOrder(sourcePrefix) {
  const b = ' #orderByTimeDirection';
  let l = [
    'time_created' + b,
    '(versid).baseid ASC',
    '(versid).vernum' + b,
  ];
  if (sourcePrefix) { l = l.map(x => sourcePrefix + '.' + x); }
  return l.join(', ');
}


const EX = {

  defaultSearchOrder,

  orderedSearch: `
    WITH found AS (
      #|\r )
    SELECT * FROM found
    ORDER BY #orderedSearchPrioritize #orderedSearchDefaultOrderNoPrefix
    LIMIT #orderedSearchLimit
    `.replace(/^ {2}/mg, ''),

  orderedSearchSource: '#unrestrictedSearch',
  orderedSearchPrioritize: '',
  orderedSearchLimit: 'ALL',

  orderByTimeDirection: 'DESC', /*
    Usually, people are more interested in newest annos.
    Bot queues however will usually want FIFO, but bots can say so.
    */

  orderedSearchDefaultOrder: defaultSearchOrder,
  orderedSearchDefaultOrderNoPrefix: defaultSearchOrder(),

};


export default EX;
