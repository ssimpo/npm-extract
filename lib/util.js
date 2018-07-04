'use strict';

const get = require('lodash.get');
const isString = require('lodash.isstring');
const isNull = require('lodash.isnull');
const isObject = require('lodash.isobject');


function _forEachKeys(obj, iteree) {
	if (Array.isArray(obj)) {
		obj.forEach((value, key)=>iteree(key))
	} else {
		Object.keys(obj).forEach(key=>iteree(key));
	}
}

function _substitute(txt, obj={}) {
	try {
		return (new Function(...[
			...Object.keys(obj),
			'return `' + txt + '`;'
		]))(...Object.keys(obj).map(key=>obj[key]));
	} catch (error) {
		return txt;
	}
}

function substituteInObject(obj, originalObj) {
	const _obj = (isString(obj)?JSON.parse(obj):obj);
	const _originalObj = originalObj || _obj;
	const matcher = JSON.stringify(_obj);

	_forEachKeys(_obj, key=>{
		if (isNull(_obj[key] || bolt.isUndefined(_obj[key]))) return _obj[key];
		if (isObject(_obj[key]) || Array.isArray(_obj[key])) _obj[key] = substituteInObject(_obj[key], _originalObj);
		if (isString(_obj[key]) && (_obj[key].indexOf('${') !== -1)) _obj[key] = _substitute(_obj[key], originalObj);
	});

	return ((JSON.stringify(_obj) !== matcher) ? substituteInObject(_obj, _originalObj) : _obj);
}

module.exports = {
	get, substituteInObject, isNull, isObject, isString
};