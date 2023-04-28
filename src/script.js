const {Float16Array} = float16;

(function () {

  function load(array, exponentBits, input, output, help, hex) {
    var bytes = new Uint8Array(array.buffer);
    var hexLength = bytes.length;

    function reduceNumber(x) {
      var copy = bytes.length === 2 ? new Float16Array(1) : bytes.length === 4 ? new Float32Array(1) : new Float64Array(1);
      copy[0] = +x;
      var value = copy[0];
      x = value === 0 && 1 / value === -Infinity ? '-0' : value + '';

      if (x === 'NaN' || x === 'Infinity' || x === '-Infinity') {
        return x;
      }

      var parts = /^([+-]?\d+)((?:\.\d+)?)((?:[eE][+-]?\d+)?)$/.exec(x);
      var whole = parts[1];
      var fraction = parts[2];
      var exponent = parts[3];

      // Remove digits one-by-one until the number changes
      while (fraction.length > 0) {
        // Try truncating
        var truncatedFraction = fraction.slice(0, -1);
        var text = whole + (truncatedFraction !== '.' ? truncatedFraction : '') + exponent;
        copy[0] = +text;
        var truncatedValue = copy[0];
        if (truncatedValue === value) {
          fraction = truncatedFraction;
          x = text;
          continue;
        }

        // Try rounding
        var roundedFraction = truncatedFraction;
        var i = roundedFraction.length - 1;
        var zero = '0'.charCodeAt(0);
        while (i > 0) {
          var c = roundedFraction.charCodeAt(i) - zero;
          roundedFraction = roundedFraction.slice(0, i) + String.fromCharCode((c + 1) % 10 + zero) + roundedFraction.slice(i + 1);
          if (c < 9) break; // Do we need to carry?
          i--;
        }
        var text = whole + (roundedFraction !== '.' ? roundedFraction : '') + exponent;
        copy[0] = +text;
        var roundedValue = copy[0];
        if (roundedValue === value) {
          fraction = roundedFraction;
          x = text;
          continue;
        }

        // Both numbers changed, keep the old value
        break;
      }

      return x;
    }

    // Populate HTML
    var html = '<table>';
    // The bit numbers
    html += '<tr>';
    for (var i = 0; i < bytes.length; i++) {
      for (var j = 0; j < 8; j++) {
        var index = (bytes.length - i) * 8 - j;
        if (j > 3) {
          html += '<td class="nibble">' + index + '</td>'
        } else {
          html += '<td class="dark nibble">' + index + '</td>'
        }
      }
    }
    html += '</tr>';
    // The bits
    html += '<tr>';
    for (var i = 0; i < bytes.length; i++) {
      for (var j = 0; j < 8; j++) {
        var index = i * 8 + j;
        var className =
          index === 0 ? 'sign' :
            index < 1 + exponentBits ? 'exponent' :
              'fraction';
        html += '<td data-index="' + index + '" class="' + className + '">0</td>';
      }
    }
    html += '</tr></table>';
    input.innerHTML = html;

    // Grab elements
    var elements = [];
    for (var i = 0; i < bytes.length * 8; i++) {
      (function (i) {
        var element = input.querySelector('[data-index="' + i + '"]');
        element.onmouseover = function () { this.classList.add('hover'); };
        element.onmouseout = function () { this.classList.remove('hover'); };
        elements.push(element);
      })(i);
    }

    // Event handlers
    function extractNumber() {
      return +(output.value.replace(/\b(?:infinity|inf)\b/gi, 'Infinity'));
    }
    output.onkeydown = function (e) {
      if (e.which === 13) {
        e.preventDefault();
        output.blur();
      }

      else if (e.which === 38) {
        e.preventDefault();
        output.value = reduceNumber(extractNumber() + 1);
        output.select();
        output.oninput();
      }

      else if (e.which === 40) {
        e.preventDefault();
        output.value = reduceNumber(extractNumber() - 1);
        output.select();
        output.oninput();
      }
    };
    output.onfocus = function () {
      output.select();
    };
    output.oninput = function () {
      array[0] = extractNumber();
      render();
    };
    output.onblur = function () {
      render();
    };

    hex.onkeydown = function (e) {
      if (e.which === 13) {
        e.preventDefault();
        hex.blur();
      }
    };
    hex.onfocus = function () {
      hex.select();
    };
    hex.oninput = function () {
      var hexAlphabet = '0123456789abcdefABCDEF';
      var validHexCharas = hex.value.split('').every(function (c) {
        return hexAlphabet.split('').lastIndexOf(c) !== -1;
      });
      if (hex.value.length > (hexLength * 2) || validHexCharas === false) {
        hex.value = hex.value.slice(0, -1);
        return;
      }

      var tmpBytes = toByteArray(hex.value);
      bytes.fill(0);
      bytes.set(tmpBytes.reverse(), hexLength - tmpBytes.length);
      render();
    };
    hex.onblur = function () {
      render();
    };

    input.onmousedown = function (e) {
      if ('index' in e.target.dataset) {
        var index = e.target.dataset.index | 0;
        var byteIndex = bytes.length - (index >> 3) - 1;
        var byteMask = 1 << (7 - (index & 7));
        var mouseDownValue = bytes[byteIndex] & byteMask ? 0 : 1;
        bytes[byteIndex] ^= byteMask;
        render();

        document.onmousemove = function (e2) {
          if ('index' in e2.target.dataset) {
            var index = e2.target.dataset.index | 0;
            var byteIndex = bytes.length - (index >> 3) - 1;
            var byteMask = 1 << (7 - (index & 7));
            bytes[byteIndex] = (bytes[byteIndex] & ~byteMask) | (byteMask * mouseDownValue);
            render();
          }
        };

        document.onmouseup = function () {
          document.onmousemove = null;
          document.onmouseup = null;
        };
      }
    };

    // Update loop
    function render() {
      for (var i = 0; i < bytes.length * 8; i++) {
        elements[i].textContent = ((bytes[bytes.length - (i >> 3) - 1] >> (7 - (i & 7))) & 1);
      }

      // Figure out exponent
      var exponent = 0;
      for (var i = 0; i < exponentBits; i++) {
        var index = 1 + i;
        var bit = (bytes[bytes.length - (index >> 3) - 1] >> (7 - (index & 7))) & 1;
        exponent += bit << (exponentBits - i - 1);
      }
      var exponentBias = (1 << (exponentBits - 1)) - 1;
      exponent -= exponentBias;

      // Figure out fraction
      var copyBytes = new Uint8Array(bytes);
      var copy = bytes.length === 2 ? new Float16Array(copyBytes.buffer) : bytes.length === 4 ? new Float32Array(copyBytes.buffer) : new Float64Array(copyBytes.buffer);
      for (var i = 0; i < exponentBits; i++) {
        var index = 1 + i;
        var byteIndex = bytes.length - (index >> 3) - 1;
        var byteMask = 1 << (7 - (index & 7));
        copyBytes[byteIndex] = (copyBytes[byteIndex] & ~byteMask) | (i === 0 ? 0 : byteMask);
      }
      var signIndex = bytes.length - 1;
      var signMask = 0x80;
      var sign = copyBytes[signIndex] & signMask;
      copyBytes[signIndex] &= ~signMask;
      var fraction = copy[0];

      // Handle denormal numbers
      if (exponent === -exponentBias) {
        exponent++;
        fraction--;
      }

      // Update views according to which input was edited
      if (document.activeElement === hex) {
        var value = array[0];
        output.value = reduceNumber(value === 0 && 1 / value === -Infinity ? '-0' : value);
      } else if (document.activeElement === output) {
        var tmpBytes = bytes.slice().reverse();
        hex.value = toHexString(tmpBytes);
      } else { // This branch is for when the individual bits get toggled
        var value = array[0];
        output.value = reduceNumber(value === 0 && 1 / value === -Infinity ? '-0' : value);
        var tmpBytes = bytes.slice().reverse();
        hex.value = toHexString(tmpBytes);
      }

      help.innerHTML =
        '<span class="sign">' + (sign ? -1 : 1) + '</span>' +
        '&nbsp;&nbsp;&times;&nbsp;&nbsp;' +
        '<span class="exponent">2<sup>' + exponent + '</sup></span>' +
        '&nbsp;&nbsp;&times;&nbsp;&nbsp;' +
        '<span class="fraction">' + reduceNumber(fraction) + '</span>';
    }

    function toHexString(byteArray) {
      return Array.from(byteArray, function (byte) {
        return ('0' + byte.toString(16).toUpperCase()).slice(-2);
      }).join('')
    }

    function toByteArray(hexString) {
      var result = [];
      if (hexString.length % 2 == 1) {
        hexString = hexString + '0';
      }
      for (var i = 0; i < hexString.length; i += 2) {
        result.push(parseInt(hexString.substr(i, 2), 16));
      }
      return result;
    }

    render();
  }

  load(new Float16Array([Math.PI]), 5, document.getElementById('input16'), document.getElementById('output16'), document.getElementById('help16'), document.getElementById('hex16'));
  load(new Float32Array([Math.PI]), 8, document.getElementById('input32'), document.getElementById('output32'), document.getElementById('help32'), document.getElementById('hex32'));
  load(new Float64Array([Math.PI]), 11, document.getElementById('input64'), document.getElementById('output64'), document.getElementById('help64'), document.getElementById('hex64'));

})();