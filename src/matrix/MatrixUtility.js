import { scaleOrdinal, rgb, packSiblings, packEnclose, select, range, format } from 'd3';

export const col2focus = {
  1: 'focus_lifestyle',
  2: 'focus_planning',
  3: 'focus_mobility',
  4: 'focus_infrastructure'
};

export const theme2row = {
  testbeds: 1,
  innovation: 2,
  financing: 3,
  management: 4,
  intelligence: 5
};

export const row2theme = {
  1: 'testbeds',
  2: 'innovation',
  3: 'financing',
  4: 'management',
  5: 'intelligence'
};

export const focusLabel = {
  1: 'Livsstil och  konsumtion',
  2: 'Planering och  byggd miljö',
  3: 'Mobilitet och  tillgänglighet',
  4: 'Integrerad  infrastruktur'
};

export const themeLabel = {
  1: 'Testbäddar och  living labs',
  2: 'Innovation och  entreprenörskap',
  3: 'Finansierings- och  affärsmodeller',
  4: 'Styrning',
  5: 'Intelligens,  cybersäkerhet  och etik'
};

export const type2class = {
  'Forskningsprojekt': 'research',
  'Innovationsprojekt': 'innovation',
  'Förstudie': 'prestudy'
}

export function circleRadius(area) {
  return Math.sqrt(area / Math.PI);
}

export const projectTypes = ['Forskningsprojekt', 'Innovationsprojekt', 'Förstudie'];
export const projectTypeColors = scaleOrdinal()
  .range([rgb(0, 125, 145), rgb(151, 194, 142), rgb(234, 154, 0)]) // pms 3145, pms 2255, pms 2011
  .domain(projectTypes);

export function packData(data, scaleX, scaleY) {
  // first, group together circles that are
  // at the same position in the matrix
  const obj = {};
  for (let row = 1; row <= 5; ++row) {
    obj[row] = {};
    for (let col = 1; col <= 4; ++col) {
      obj[row][col] = [];
    }
  }
  data.data.forEach(project => {
    const pins = []; // so that a circle can find its buddies
    for (let col = 1; col <= 4; ++col) {
      project.survey_answers[col2focus[col]].forEach(theme => {
        pins.push({
          row: theme2row[theme],
          col
        });
        obj[theme2row[theme]][col].push({
          row: theme2row[theme],
          col,
          pins,
          survey_answers: project.survey_answers,
          r: circleRadius(project.survey_answers.budget.funded)
        })
      });
    }
  });

  // first pass: pack circles and find the "optimal scale"
  // and redo the circle radii to use that scale
  let maxEnclose = 0;
  for (let row = 1; row <= 5; ++row) {
    for (let col = 1; col <= 4; ++col) {
      if (!obj[row][col].length) continue; // if empty continue
      packSiblings(obj[row][col]);
      maxEnclose = Math.max(maxEnclose, packEnclose(obj[row][col]).r);
    }
  }
  const optimalEncloseRadius = Math.min(scaleX.step() / 2, scaleY.step() / 2); // * 0.95?
  const rScale = optimalEncloseRadius / maxEnclose;
  for (let row = 1; row <= 5; ++row) {
    for (let col = 1; col <= 4; ++col) {
      obj[row][col].forEach(pin => {
        pin.r = circleRadius(pin.survey_answers.budget.funded) * rScale;
      });
    }
  }

  // second pass: pack again, fix positions
  // and return as a flat list
  const arr = [];
  for (let row = 1; row <= 5; ++row) {
    for (let col = 1; col <= 4; ++col) {
      packSiblings(obj[row][col]).forEach(pin => {
        arr.push({
          ...pin,
          x: pin.x + scaleX(col),
          y: pin.y + scaleY(row),
          rScale
        })
      });
    }
  }
  return arr;
}

export function buildScaleData(packedData) {
  if (!packedData.length) return null;

  const sortedPackedData = [...packedData].sort((a, b) => a.survey_answers.budget.funded - b.survey_answers.budget.funded);
  const minBudget = sortedPackedData[0].survey_answers.budget.funded;
  const maxBudget = sortedPackedData[sortedPackedData.length - 1].survey_answers.budget.funded;
  const rScale = packedData[0].rScale;

  const labelNumbers = [];
  const circleRadii = [];

  labelNumbers[0] = Number.parseInt(maxBudget).toPrecision(1);
  labelNumbers[1] = Number.parseInt(maxBudget / 2).toPrecision(1);
  labelNumbers[2] = Number.parseInt(maxBudget / 10).toPrecision(1);

  circleRadii[0] = circleRadius(labelNumbers[0]) * rScale;
  circleRadii[1] = circleRadius(labelNumbers[1]) * rScale;
  circleRadii[2] = circleRadius(labelNumbers[2]) * rScale;

  if (Number.parseInt(maxBudget).toPrecision(1) === Number.parseInt(minBudget).toPrecision(1))
    return [{
      r: circleRadii[0],
      label: `${format(',')(labelNumbers[0]).replace(/,/g, ' ')} kr`
    }];

  return range(3).map(i => ({
    r: circleRadii[i],
    label: `${format(',')(labelNumbers[i]).replace(/,/g, ' ')} kr`
  }));
}

// inspired by https://bl.ocks.org/mbostock/7555321
// replaces double spaces in the labels with fake "newlines"
// (tspan elements) and fixes their positions
export function parseNewlinesY(texts) {
  texts.each(function() {
    const text = select(this);
    const words = text.text().split(/ {2}/);
    const x = text.attr('x');
    const dy = parseFloat(text.attr('dy'));
    text.text(null);
    const lineHeight = 1.3; // em
    let i = 0;
    words.forEach(word => {
      text.append('tspan')
          .text(word)
          .attr('x', x)
          .attr('y', `-${(words.length - 1) * lineHeight / 2}em`)
          .attr('dy', `${dy + (i++ * lineHeight)}em`);
    });
  });
}
export function parseNewlinesX(texts) {
  texts.each(function() {
    const text = select(this).attr('text-anchor', 'start');
    const words = text.text().split(/ {2}/);
    const y = text.attr('y');
    const dy = parseFloat(text.attr('dy'));
    text.text(null);
    const lineHeight = 1.3; // em
    let i = 0;
    words.forEach(word => {
      text.append('tspan')
          .text(word)
          .attr('x', 0)
          .attr('dy', `${dy + (i++ * lineHeight)}em`);
    });
    text.attr('transform', `translate(0,${y})rotate(-45)translate(0,${-y})`);
  });
}