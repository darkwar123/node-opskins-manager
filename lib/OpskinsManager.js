/**
 * Modules
 * @private
 * */
const fs = require('fs');
const path = require('path');
const util = require('util');
const FileStorage = require('./FileStorage');
const AppDirectory = require('appdirectory');
const OPSkinsAPI = require('@opskins/api');

/**
 * Constructor(options)
 * @param {String} [accountName]- pseudo name for debug only.
 * @param {String} apiKey - key for Opskins Web API, you can find it here https://opskins.com/?loc=store_account.
 * @param {Number} [appID] - game appID you want to handle.
 * @param {Number} [contextID] - game contextID you want to handle.
 * @constructor
 * */
let OpskinsManager = function OpskinsManager ({ accountName, apiKey, appID = 730, contextID = 2 } = { }) {
    if (!(this instanceof OpskinsManager)) {
        return new OpskinsManager(...arguments);
    }

    if (!apiKey) {
        throw new Error('apiKey is required');
    }

    this.debug = require('debug')('node-opskins-manager:' + (accountName ? accountName : apiKey));

    this.apiKey = apiKey;
    this.appID = appID;
    this.contextID = contextID;

    this._dataDir = (new AppDirectory({
        "appName": "node-opskins-manager",
        "appAuthor": "darkwar123"
    })).userData();

    this._opskins = new OPSkinsAPI(this.apiKey);
    this._inventoryStorage = new FileStorage(path.join(this._dataDir, 'inventory'));

    this.setInventory();
};

/**
 * Set up inventory in the memory
 * */
OpskinsManager.prototype.setInventory = function setInventory () {
    this.debug('setting up inventory');

    let self = this;
    let inventoryFile = 'inventory_' + this.apiKey + '_' + this.appID + '_' + this.contextID + '.json';

    this.inventory = [];

    this.inventory.__proto__.findByName = function (name) {
        let result = null;

        for (let i = 0; i < this.length; i++) {
            const element = this[i];

            if(element.name == name){
                result = element;
                break;
            }
        }

        return result;
    };

    this.inventory.__proto__.findIndexById = function (item) {
        let id = typeof item === 'object' ? item.id : item;

        let index = -1;

        for (let i = 0; i < this.length; i++) {
            const element = this[i];

            if(element.id == id){
                index = i;
                break;
            }
        }

        return index;
    };

    this.inventory.__proto__.addItem = function (item) {
        item = {
            id: item.id,
            name: item.name,
            appid: item.appid,
            contextid: item.contextid
        };

        if (this.findIndexById(item) === -1 && !!item.id) {
            this.push(item);
            self._inventoryStorage.save(inventoryFile, this);
        }
    };

    this.inventory.__proto__.removeItem = function (item) {
        let index = this.findIndexById(item);

        if (index !== -1) {
            this.splice(index, 1);
            self._inventoryStorage.save(inventoryFile, this);
        }
    };

    let inventory = this._inventoryStorage.read(inventoryFile);

    if(inventory){
        this.inventory = inventory;
        this.debug('set up inventory');
    }else{
        this.getInventory()
        .then(items => {
            for(let i in items){
                this.inventory.addItem(items[i]);
            }
            this.debug('set up inventory');
        })
        .catch(err => this.debug('can\'t set inventory items: %s', err.message))
    }
};

/**
 * Get opskins inventory
 * @return {Promise} - return items on success
 * */
OpskinsManager.prototype.getInventory = function getInventory () {
    return new Promise((resolve, reject) => {
        this._opskins.getInventory((err, { items }) => {
            if(err){
                return reject(err);
            }

            return resolve(items);
        });
    });
};

/**
 * Buy item on Opskins
 * @param {String} name - item market_hash_name
 * @param {Number} [max] - max item price in USD
 * @return {Promise} - return item on success
 * */
OpskinsManager.prototype.buy = function buy ({ name, max }) {
    return new Promise((resolve, reject) => {
        /*at first check this item in our inventory*/
        const fromInventory = this.inventory.findByName(name);

        if (fromInventory) {
            return resolve(fromInventory);
        }

        let query = {
            search_item: '"'+ name +'"',
            app: this.appID + '_' + this.contextID
        };

        if(typeof max === 'number'){
            query['max'] = max;
        }

        this._opskins.search(query, (err, sales = []) => {
            let itemToBuy = null;

			for(let i in sales){
				if(sales[i].name === name){
					itemToBuy = sales[i];
					break;
				}
			}
			
            if(err || itemToBuy === null){
                return reject(err || new Error('Item wasn\'t found'));
            }
			
            this._opskins.buyItems([itemToBuy.id], Number(itemToBuy.amount), (err, items) => {
                if(err){
                    return reject(err);
                }

                let item = {
                    id: items[0].new_itemid,
                    name: items[0].name,
                    appid: this.appID,
                    contextid: this.contextID
                };

                this.inventory.addItem(item);

                resolve(item);
            });
        });
    });
};

/**
 * Withdraw item from Opskins to Steam
 * @param {Object} item - item to withdraw
 * @return {Promise} - return offer on success
 * */
OpskinsManager.prototype.withdraw = function withdraw (item) {
    return new Promise((resolve, reject) => {
        this.inventory.removeItem(item);

        this._opskins.withdrawInventoryItems([item.id], (err, data) => {
            if(err){
                this.inventory.addItem(item);
                return reject(err);
            }

            const offer = data.offers[0];

            resolve({
                items: offer.items,
                bot_id : offer.bot_id,
                id: offer.tradeoffer_id,
                tradeoffer_error: offer.tradeoffer_error
            });
        });
    });
};

module.exports = OpskinsManager;