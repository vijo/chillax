(function($){
  
  /*!
   * jQuery xmlDOM Plugin v1.0
   * http://outwestmedia.com/jquery-plugins/xmldom/
   *
   * Released: 2009-04-06
   * Version: 1.0
   *
   * Copyright (c) 2009 Jonathan Sharp, Out West Media LLC.
   * Dual licensed under the MIT and GPL licenses.
   * http://docs.jquery.com/License
   */
  (function($) {
    // IE DOMParser wrapper
    if ( window['DOMParser'] == undefined && window.ActiveXObject ) {
      DOMParser = function() { };
      DOMParser.prototype.parseFromString = function( xmlString ) {
        var doc = new ActiveXObject('Microsoft.XMLDOM');
            doc.async = 'false';
            doc.loadXML( xmlString );
        return doc;
      };
    }

    $.xmlDOM = function(xml, onErrorFn) {
      try {
        var xmlDoc  = ( new DOMParser() ).parseFromString( xml, 'text/xml' );
        if ( $.isXMLDoc( xmlDoc ) ) {
          var err = $('parsererror', xmlDoc);
          if ( err.length == 1 ) {
            throw('Error: ' + $(xmlDoc).text() );
          }
        } else {
          throw('Unable to parse XML');
        }
      } catch( e ) {
        var msg = ( e.name == undefined ? e : e.name + ': ' + e.message );
        if ( $.isFunction( onErrorFn ) ) {
          onErrorFn( msg );
        } else {
          $(document).trigger('xmlParseError', [ msg ]);
        }
        return $([]);
      }
      return $( xmlDoc );
    };
  })($);
  
  
  /* jFeed : jQuery feed parser plugin
   * Copyright (C) 2007 Jean-François Hovinne - http://www.hovinne.com/
   * Dual licensed under the MIT (MIT-license.txt)
   * and GPL (GPL-license.txt) licenses.
   */
  (function($){

    function JFeed(xml) {
      if(xml) this.parse(xml);
    };

    JFeed.prototype = {
      type: '',
      version: '',
      title: '',
      link: '',
      description: '',
      parse: function(xml) {
        xml = (typeof xml == 'string') ? $.xmlDOM(xml) : $(xml);
        if($('channel', xml).length == 1) {
          this.type = 'rss';
          var feedClass = new JRss(xml);
        } else if($('feed', xml).length == 1) {
          this.type = 'atom';
          var feedClass = new JAtom(xml);
        }
        if(feedClass) $.extend(this, feedClass);
      }
    };

    function JFeedItem() {};

    JFeedItem.prototype = {
      title: '',
      link: '',
      description: '',
      updated: '',
      id: '',
      author: ''
    };

    function JAtom(xml) {
      this._parse(xml);
    };

    JAtom.prototype = {

      _parse: function(xml) {
        var channel = $('feed', xml).eq(0);

        this.version = '1.0';
        this.title = $(channel).find('title:first').text();
        this.link = $(channel).find('link:first').attr('href');
        this.description = $(channel).find('subtitle:first').text();
        this.language = $(channel).attr('xml:lang');
        this.updated = $(channel).find('updated:first').text();

        this.items = new Array();

        var feed = this;

        $('entry', xml).each( function() {
          var item = new JFeedItem();

          item.title = $(this).find('title').eq(0).text();
          item.link = $(this).find('link').eq(0).attr('href');
          item.description = $(this).find('content').eq(0).text();
          item.updated = $(this).find('updated').eq(0).text();
          item.id = $(this).find('id').eq(0).text();
          item.author = $(this).find('author,creator').not(':empty').eq(0).text();

          feed.items.push(item);
        });
      }
    };

    function JRss(xml) {
      this._parse(xml);
    };

    JRss.prototype  = {

      _parse: function(xml) {
        xml = $(xml);
        if($('rss', xml).length == 0) this.version = '1.0';
        else this.version = $('rss', xml).eq(0).attr('version');

        var channel = $('channel', xml).eq(0);

        this.title = $(channel).find('title:first').text();
        this.link = $(channel).find('link:first').text();
        this.description = $(channel).find('description:first').text();
        this.language = $(channel).find('language:first').text();
        this.updated = $(channel).find('lastBuildDate:first').text();

        this.items = new Array();

        var feed = this;

        $('item', xml).each( function() {
          var item = new JFeedItem(),
            $desc = $(this).find('description'),
            desc = '';
          $desc.each(function() {
            var text = $(this).text();
            if (text.length > desc.length) { desc = text; }
          })
          
          item.title = $(this).find('title').eq(0).text();
          item.link = $(this).find('link').eq(0).text();
          item.description = desc;
          item.updated = $(this).find('pubDate').eq(0).text();
          item.id = $(this).find('guid').eq(0).text();
          item.author = $(this).find('author,creator').not(':empty').eq(0).text();

          feed.items.push(item);
        });
      }
    };
  
    $.JFeed = JFeed;
    
  })($);

  // utility for uniquely identifying elements
  $.id = function(elem) {
    return $.data($(elem).get(0));
  };

  $.widget('ui.infiniscroll', {
    
    options: {
      disabled: false,
      marginRows: 100,
      startY: 0,
      recenterAfter: 500,
      innerHeight: 16000,
      sectionProperty: '',
      sectionChange: function() {},
      createRow: function(item) {
        return $('<div></div>').text(item.content);
      },
      refreshRows: function(rows, first, last) {
        // dummy callback, doesn't alter data
        return 0;
      }
    },
    
    _init: function() {
      var $elem = this.element, 
        o = this.options;
      
      this.rows = [];
      this.inner = $elem.children('.scroll-inner');
      this.content = this.inner.children('.scroll-content').css('height', o.innerHeight);
      this.sectionOffsets = [];
      this.currentSection = 1;
      
      this.realY = o.startY;
      this.virtualY = Math.floor(o.innerHeight / 2);
      this.inner.scrollTop(this.virtualY);
      this.recenterTimer = null;
      this.virtualHeader = $elem.children('.virtual-header');
      
      this._bindEvents();
      this.recenter();
    },
    
    _bindEvents: function() {
      var self = this,
        $elem = this.element;
      this.ignoreNextScroll = false;
      this.inner.bind('scroll.infiniscroll', function() { self._scroll.apply(self, arguments); });
      $(window).bind('resize.infiniscroll', function() { self.redraw(); });
    },
    
    _calcOffsets: function(skipVisibility) {
      var self = this,
        o = this.options,
        offset = 0,
        that = this,
        passedFirstVisible = false,
        contentRepeats = 0,
        sectionId = null;
      this.contentHeight = 0;
      this.sectionOffsets = {};
      $.each(this.rows, function(index, val) {
        val.offset = offset;
        offset += val.height;
        that.contentHeight += val.height;
        if (val[o.sectionProperty] !== sectionId) {
          sectionId = val[o.sectionProperty];
          self.sectionOffsets[sectionId] = {offset: val.offset, row: val};
        }
      });
      this.realY = this._positiveMod(this.realY, this.contentHeight);
      this.tooShort = this.contentHeight < this.height;
      if (!skipVisibility) {
        this.firstVisible = null;
        this.lastVisible = null;
        $.each(this.rows, function(index, val) {
          if (!passedFirstVisible) { self.firstVisible = index; }
          if (val.offset > that.realY + self.height) { self.lastVisible = index - 1; return false; }
          if (val.offset + val.height > that.realY) { passedFirstVisible = true; }
        });
        while (self.lastVisible === null && this.rows.length) {
          ++contentRepeats;
          $.each(this.rows, function(index, val) {
            if (val.offset + self.contentHeight * contentRepeats > that.realY + self.height) { 
              self.lastVisible = index - 1;
              return false;
            }
          });
        }
        if (self.lastVisible === -1) { self.lastVisible += this.rows.length; }
      }
    },
    
    _positiveMod: function(num, length) {
      if (!length) { return 0; }
      while (num < 0) { num += length; }
      return num % length;
    },

    _createRow: function(item, top) {
      var $row = this.options.createRow(item);
      $row.addClass('infini-row').css({position: 'absolute', height: item.height});
      if (top !== undefined) { $row.css('top', top); }
      return $row;
    },
    
    _refreshRows: function(force) {
      var self = this,
        o = this.options,
        deltaFirst,
        initOffset = this.firstVisible !== null ? this.rows[this.firstVisible].offset : 0;
      if (this.tooShort || this.firstVisible===null || force) {
        // "dumb" refresh: get everything
        deltaFirst = o.refreshRows(this.rows);
      } else {
        // "smart" refresh: get everything outside the viewport
        deltaFirst = o.refreshRows(this.rows, this.firstVisible, this.lastVisible);
      }
      this._calcOffsets(true);
      var length = this.rows.length;
      if (this.firstVisible !== null) {
        if (this.firstVisible <= this.lastVisible) {
          this.lastVisible = this._positiveMod(this.lastVisible + deltaFirst, length);
        }
        this.firstVisible = this._positiveMod(this.firstVisible + deltaFirst, length);
        this.realY += (this.rows[this.firstVisible].offset - initOffset);        
      }
    },
    
    redraw: function(force) {
      var self = this,
        $elem = this.element,
        scrollTop = this.inner.scrollTop(),
        o = this.options,
        withinContent = true,
        overflowed = 0,
        index = 0,
        minTop = o.innerHeight,
        maxTop = 0,
        isTopEven = true;
        isBottomEven = false;
      
      this.height = $elem.height();
      this._calcOffsets();
      
      // Remove rows not within viewport
      var $rows = this.content.children('.infini-row');
      if (!this.tooShort && !force) {
        $rows = $rows.filter(function() {
          var top = parseInt($(this).css('top'), 10);
          var removeIt = ((top + $(this).height() < scrollTop) || (top > scrollTop + self.height));
          if (!removeIt) {
            minTop = Math.min(top, minTop);
            if (minTop == top) { isTopEven = $(this).hasClass('even'); }
            maxTop = Math.max(top, maxTop);
            if (maxTop == top) { isBottomEven = $(this).hasClass('even'); }
          }
          return removeIt;
        });
      }
      $rows.remove();
      
      // Get new data, possibly all of it, or just what's outside of the viewport
      self._refreshRows(force);
      var length = this.rows.length;
      
      // No rows?  Nothing to do
      $elem.toggleClass('no-rows', !length);
      if (!length) { return; }
      
      // Draw rows within viewport and beyond bottom edge
      while (overflowed < o.marginRows) {
        var repeat = Math.floor((this.firstVisible + index) / length),
          row = this.rows[this._positiveMod(this.firstVisible + index, length)],
          top = this.virtualY - this.realY + row.offset + repeat * this.contentHeight,
          $row;
        if (top < minTop || top > maxTop) {
          $row = this._createRow(row, top);
          (isBottomEven = !isBottomEven) && $row.addClass('even');
          $row.appendTo(this.content);
        }
        index++;
        this.rowsBottom = top + row.height;
        withinContent = (top <= scrollTop + self.height);
        withinContent || overflowed++;
      }
      
      // Draw rows beyond top edge
      index = -1;
      while (index > -o.marginRows) {
        var repeat = Math.floor((this.firstVisible + index) / length),
          row = this.rows[this._positiveMod(this.firstVisible + index, length)],
          top = this.virtualY - this.realY + row.offset + repeat * this.contentHeight,
          $row = this._createRow(row, top);
        (isTopEven = !isTopEven) && $row.addClass('even');
        $row.appendTo(this.content);
        index--;
        this.rowsTop = top;
      }
      
      // redraw virtual header
      this._updateSection(scrollTop);
    },
    
    recenter: function() {
      var scrollTop = this.inner.scrollTop(),
        diff = scrollTop - this.virtualY;
      this.realY += diff;
      this.content.children('.infini-row').each(function() {
        var $r = $(this), top = parseInt($r.css('top'), 10);
        $r.css('top', (top - diff) + 'px');
      });
      this.ignoreNextScroll = true;
      this.inner.scrollTop(this.virtualY);
      this.redraw();
    },
    
    repositionAfter: function($row, deltaY) {
      var afterTop = parseInt($row.css('top'), 10);
      this.content.children('.infini-row').each(function() {
        var $r = $(this), top = parseInt($r.css('top'), 10);
        if (top > afterTop) { $r.css('top', top + deltaY); }
      });
    },
    
    _scroll: function(event) {
      var self = this,
        o = this.options,
        scrollTop = this.inner.scrollTop(),
        desperate = (scrollTop < this.rowsTop) || (scrollTop + this.height > this.rowsBottom),
        reallyDesperate = (scrollTop < 400) || (scrollTop + this.height > o.innerHeight - 400);
              
      clearTimeout(this.recenterTimer);
      if (!this.ignoreNextScroll) {
        // redraw virtual header
        this._updateSection(scrollTop);
        
        // set timers for redrawing
        if (reallyDesperate) {
          // running out of native scroll space!
          self.recenter();
        } else if (desperate) {
          // could possibly just draw more rows in the direction of the scrolling...
          this.recenterTimer = setTimeout(function() { self.recenter(); }, o.recenterAfter);
        } else {
          this.recenterTimer = setTimeout(function() { self.recenter(); }, o.recenterAfter);
        }
      }
      this.ignoreNextScroll = false;
    },
    
    _updateSection: function(scrollTop) {
      var self = this,
        realOffset = this._positiveMod(this.realY + scrollTop - this.virtualY, this.contentHeight),
        headerOffset = 0;
      // set current section
      $.each(this.sectionOffsets, function(index, val) {
        headerOffset = realOffset - val.offset;
        if (headerOffset < 0) { return false; }
        self.currentSection = index;
      });
      // within last section ?
      if (headerOffset >= 0) { headerOffset = realOffset - this.contentHeight; }
      var item = this.sectionOffsets[this.currentSection].row;
      this.virtualHeader.css('top', headerOffset > -item.height ? -headerOffset - item.height : 0);
      // show virtual section header
      if (this.virtualHeader.data('sectionId') !== this.currentSection) {
        this.virtualHeader.empty().append(this._createRow(item, 0)).data('sectionId', this.currentSection);
        this._trigger('sectionChange', {}, {sectionId: this.currentSection});
      }
    },
    
    gotoSection: function(sectionId) {
      var scrollTop = this.inner.scrollTop(),
        section = this.sectionOffsets[sectionId];
      if (section) { this.inner.scrollTop(section.offset - this.realY + this.virtualY); }
      clearTimeout(this.recenterTimer);
      this.recenter();
    }
    
  });

  function ChillaxReader(options) {
    var self = this;
    // This is a singleton object, enfore single instance
    if ( arguments.callee._singletonInstance ) { return arguments.callee._singletonInstance; }
    arguments.callee._singletonInstance = this;
  
    var defaults = {
      els: {
        infiniscroll: '#infini-scroll',
        sources: '#sources',
        content: '#content',
        contentFrame: '#content-frame',
        socialFrame: '#social-frame',
        socialButtons: '#social-buttons',
        sourceButtons: '#source-buttons',
        addSource: '#add-source',
        removeSource: '#remove-source',
        refreshSource: '#refresh-source',
        addDialog: '#add-dialog',
        removeDialog: '#remove-dialog'
      },
      tableDefs: {
        feeds: '(\
          id INTEGER PRIMARY KEY ASC, \
          label TEXT, \
          f_title TEXT, \
          type TEXT, \
          f_link TEXT, \
          homepage TEXT, \
          seq INTEGER, \
          icon TEXT, \
          f_description TEXT, \
          use_viewtext INTEGER DEFAULT 1, \
          multisource INTEGER \
        )',
        items: '(\
          id INTEGER PRIMARY KEY ASC, \
          feed_id INTEGER REFERENCES feeds (id) ON DELETE CASCADE, \
          title TEXT, \
          link TEXT, \
          domain TEXT, \
          description TEXT, \
          full_text TEXT, \
          author TEXT, \
          updated INTEGER, \
          clicked INTEGER DEFAULT 0, \
          UNIQUE (feed_id, link) ON CONFLICT REPLACE\
        )'
      },
      startFeeds: [
        { 
          label: 'nyt: top pop', 
          link: 'http://www.nytimes.com/services/xml/rss/nyt/pop_top.xml',
          homepage: 'http://www.nytimes.com/'
        },{ 
          label: 'news.yc >20',
          link: 'http://feeds.feedburner.com/newsyc20?format=xml',
          homepage: 'http://news.ycombinator.com/'
        },{ 
          label: 'googlenews',
          link: 'http://news.google.com/news?pz=1&cf=all&ned=us&hl=en&output=rss',
          use_viewtext: false
        },{ 
          label: 'gruberball',
          link: 'http://daringfireball.net/index.xml',
          use_viewtext: false
        } ,{ 
          label: 'the crimson',
          link: 'http://www.thecrimson.com/feeds/top',
        },{ 
          label: 'techcrunch',
          link: 'http://feeds.feedburner.com/Techcrunch',
          icon: 'http://www.crunchbase.com/images/icons/techcrunch_new_logo_sm.png'
        },{
          label: 'globe local',
          link: 'http://syndication.boston.com/news/local?mode=rss_10'
        },{
          label: 'ars etc',
          link: 'http://feeds.arstechnica.com/arstechnica/etc/',
          homepage: 'http://arstechnica.com'
        }
      ],
      heights: {
        item: [70, 58, 44, 27],
        item_title : 33,
        header: 25
      },
      wrapImageWidth: 70,
      refreshInterval: 20 * 60 * 1000,
      collapseClicked: false,
      rssProxy: 'http://chillaxapp.com/proxy.php?url=',
      defaultFavicon: 'http://chillaxapp.com/images/rss.png',
      faviconAPI: 'http://getfavicon.appspot.com/',
      viewTextAPI: 'http://viewtext.org/api/text?rl=false&url=',
      hnCommentsAPI: 'http://api.ihackernews.com/getid?format=jsonp&url=',
      hnCommentsURL: 'http://news.ycombinator.com/item?id=',
      hnPostAPI: 'http://api.ihackernews.com/post/',
      redditCommentsAPI: 'http://www.reddit.com/api/info.json?url=',
      redditCommentsURL: 'http://www.reddit.com'
    };
    var o = this.options = $.extend({}, defaults, options || {});

    var $els = {};
    $.each(o.els, function(index, val) {
      $els[index] = $(val);
    });
    
    /**
     * Initialize public instance variables
     **/
    $.extend(this, {
      db: null,
      items: [],
      itemsById: {},
      showingItem: null,
      fetchAllTimeout: null
    });
    
    /**
     * Private functions, database related
     **/
    function initializeDatastore(forceDrop, success, fail) {
      if (!window.openDatabase) { fail(); }
      var db = self.db = window.openDatabase('chillax', '1.0', 'Chillax RSS data', 50 * 1024 * 1024);
      if (!db) { fail(); }
      db.transaction(function (tx) {
        $.each(o.tableDefs, function(index, val) {
          if (forceDrop) { tx.executeSql('DROP TABLE IF EXISTS ' + index); }
          tx.executeSql('CREATE TABLE IF NOT EXISTS ' + index + ' '  + val);
        });
        tx.executeSql('SELECT COUNT(*) FROM feeds', [], function(tx, result) {
          var len = o.startFeeds.length,
            count = 0;
          if (!result.rows.item(0)['COUNT(*)']) {
            $.each(o.startFeeds, function(index, val) {
              val.icon = getIconURL(val);
              addFeed(val, function() {
                if (++count == len) { success(); }
              });
            });
          } else { success(); }
        })
      });
    };
    function forEachFeed(callback, interval, allDone) {
      self.db.transaction(function (tx) {
        tx.executeSql("SELECT * from feeds ORDER BY seq ASC", [], function(tx, result) {
          for (var i = 0; i < result.rows.length; i++) {
            var item = result.rows.item(i);
            if (interval) {
              setTimeout(function() { callback(item); }, interval * i + 1);
            } else {
              callback(item);
            }
          }
          $.isFunction(allDone) && allDone();
        });
      });
    };
    function withFeed(feedId, callback) {
      self.db.transaction(function (tx) {
        tx.executeSql("SELECT * from feeds WHERE id = ? LIMIT 1", [feedId], function(tx, result) {
          if (result.rows.length) { callback(result.rows.item(0)); }
        });
      });
    };
    function getIconURL(feedSpec) {
      var baseUrl, matches = feedSpec.link.match(/^[a-z]+:\/\/[^\/]+\//i);
      baseUrl = feedSpec.homepage || (matches && matches[0]);
      icon = feedSpec.icon || '';
      if (baseUrl && !icon) {
        icon = o.faviconAPI + encodeURIComponent(baseUrl) + '?defaulticon=' 
          + encodeURIComponent(o.defaultFavicon);
      }
      return icon;
    }
    function rowToObject(item) {
      var ret = {};
      for (var i in item) {
        ret[i] = item[i];
      }
      return ret;
    };
    function normalizeDomain(url) {
      var pieces = url.split(/\/+/g),
        domain = pieces[1] && (url.indexOf('://') != -1) ? pieces[1] : pieces[0];
      return domain.replace(/^www\./, '');
    };
    function cleanFulltext(fulltext) {
      return fulltext.replace(/<h1>PAGE (\d+)<\/h1>/g, '<div class="pagechange">page $1</div>');
    };
    function calcHeight(item) {
      if ((!o.collapseClicked || !item.clicked) && $.trim(item.description).length > 10) {
        // logic regarding visibility...
        return o.heights.item[0]; 
      }
      // collapse this item
      return o.heights.item[item.multisource ? 2 : 3];
      
    };
    function fetchItems(fullRefresh) {
      self.db.transaction(function (tx) {
        var after = ((new Date()).getTime() / 1000) - 86400,
          cols = 'f_title, label, type, f_link, homepage, seq, icon, f_description, multisource';
        tx.executeSql("SELECT items.*, "+cols+" from items LEFT JOIN feeds on items.feed_id=feeds.id WHERE updated > ?\
          ORDER BY feeds.seq ASC, updated DESC, items.link ASC", [after], function(tx, result) {
          self.items = [];
          var currFeed = null, item;
          $els.sources.find('.source').addClass('ui-state-disabled');
          for(var i = 0; i < result.rows.length; i++) {
            item = result.rows.item(i);
            if (currFeed != item.feed_id) {
              self.items.push({
                type: 'feed_header', 
                title: item.label, 
                seq: item.seq,
                icon: item.icon,
                feed_id: item.feed_id,
                height: o.heights.header
              });
              currFeed = item.feed_id;
              $('#feed-' + currFeed).removeClass('ui-state-disabled');
            }
            item = rowToObject(item);
            item.full_text = {text: item.full_text};
            item.type = 'feed_item';
            // 0 here needs to be replaced with height based on visibility...
            item.height = calcHeight(item);
            self.itemsById[item.id] = self.items.push(item) - 1;
          }
          fullRefresh && $els.infiniscroll.infiniscroll('redraw', true);
        });
      });
    };
    function pullNewItems(feed, callback) {
      
      function insertItems(data) {
        var feedData = new $.JFeed(data);
        self.db.transaction(function (tx) {
          tx.executeSql("UPDATE feeds SET f_title = ?, type= ?, f_description = ? WHERE id = ?", 
            [feedData.title, feedData.type, feedData.description, feed.id]);
        });
        var length = feedData.items && feedData.items.length, count = 0, domains = {}, domainCount = 0;
        feedData.items && $.each(feedData.items, function(index, item) {
          var updated = (item.updated ? new Date(item.updated) : new Date()).getTime() / 1000,
            shortDesc = $('<div>'+item.description+'</div>').text().substr(0, 300),
            domain = normalizeDomain(item.link);
          if (!domains[domain]) { domains[domain] = true; domainCount++; }
          self.db.transaction(function (tx) {
            var args = [item.title, shortDesc, cleanFulltext(item.description), updated, item.author, domain, feed.id, item.link];
            tx.executeSql("UPDATE items SET title=?, description=?, full_text=?, updated=?, author=?, domain=? WHERE \
              feed_id=? AND link=?", args, 
            function(tx, result) {
              !result.rowsAffected && tx.executeSql("INSERT INTO items (title, description, full_text, \
                updated, author, domain, feed_id, link) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", args);
            });
            if (++count == length) {
              // If this is a multisource feed, domains are interesting.
              tx.executeSql("UPDATE feeds SET multisource = ? WHERE id = ?", [domainCount > 3 ? 1 : 0, feed.id]);
              callback();
            }
          });
        });
      }
      
      if (feed.use_viewtext) {
        $.getJSON(o.viewTextAPI + encodeURIComponent(feed.f_link) + "&callback=?", function (data) {
          insertItems(data.content);
        });
      } else {
        $.get(o.rssProxy + encodeURIComponent(feed.f_link), insertItems);
      }
      
    };
    function fetchAllFeeds(fullRefresh, interval) {
      fullRefresh = fullRefresh===true;
      var callback = function() { fetchItems(fullRefresh); };
      forEachFeed(function(feed) { pullNewItems(feed, callback); }, interval);
    };
    function recordClick(item, callback) {
      self.db.transaction(function (tx) {
        tx.executeSql("UPDATE items SET clicked = 1 WHERE id=?", [item.id], function(tx, result) {
          self.items[self.itemsById[item.id]].clicked = item.clicked = 1; // update it in local JS cache too
          if (o.collapseClicked) {
            self.items[self.itemsById[item.id]].height = item.height = calcHeight(item);
          }
          callback(result);
        });
      });
    };
    function addFeed(feedSpec, callback) {
      feedSpec.use_viewtext = (feedSpec.use_viewtext === undefined || feedSpec.use_viewtext) ? 1 : 0;
      self.db.transaction(function (tx) {
        var icon = getIconURL(feedSpec);
        tx.executeSql('SELECT seq FROM feeds ORDER BY seq DESC LIMIT 1', [], function(tx, result) {
          var seq = result.rows.length ? result.rows.item(0).seq : 0;
          tx.executeSql('INSERT INTO feeds (label, f_link, homepage, icon, seq, use_viewtext) VALUES (?, ?, ?, ?, ?, ?)', 
            [feedSpec.label, feedSpec.link, feedSpec.homepage, icon, ++seq, feedSpec.use_viewtext], function(tx, result) {
            $.isFunction(callback) && callback(result);
          });
        });
      });
    }
    function removeFeed(feedId, callback) {
      self.db.transaction(function (tx) {
        tx.executeSql('DELETE FROM items WHERE feed_id = ?', [feedId]);
        tx.executeSql('DELETE FROM feeds WHERE id = ?', [feedId], function(tx, result) {
          $.isFunction(callback) && callback(result);
        });
      });
    }
    
    /**
     * Private functions, UI related
     **/
    function initUI() {
      $els.infiniscroll.infiniscroll({
        sectionProperty: 'feed_id',
        createRow: createRow,
        refreshRows: refreshRows,
        sectionChange: sectionChange
      });
      $els.socialFrame.tabs({
        collapsible: true,
        show: showSocialTab,
        select: selectSocialTab
      }).removeClass('ui-corner-all');

      $els.infiniscroll.click(function(e) {
        var $a = $(e.target).closest('a');
        if ($a.length && wasLeftClick(e)) { clickItem($a); return false; }
      });
      $els.sources.click(function(e) {
        var $div = $(e.target).closest('.source');
        if ($div.length && !$div.hasClass('ui-state-disabled') && $div.data('feedId')) { 
          $els.infiniscroll.infiniscroll('gotoSection', $div.data('feedId'));
        }
      });

      $els.addSource.button({text: false, icons: {primary: 'ui-icon-plusthick'}}).click(openAddDialog);
      $els.removeSource.button({text: false, icons: {primary: 'ui-icon-minusthick'}}).click(openRemoveDialog);
      $els.refreshSource.button({text: false, icons: {primary: 'ui-icon-refresh'}}).click(refreshAllFeeds);
      $els.sourceButtons.buttonset();

      var dialogOptions = {
        autoOpen: false,
        resizable: false,
        closable: false,
        open: function(event) {
          var $this = $(this);
          var $dialog = $(this).closest('.ui-dialog');
          $this.find('form:not(.unsubmittable)').submit(function() {
            $dialog.find('.ui-dialog-buttonpane').find('button:last').click(); 
            return false;
          }).addClass('unsubmittable');
          $this.find('input:visible,select,textarea').eq(0).focus();
          $dialog.find('input:visible:not(.submitonenter)').keypress(function(e) {
            if (e.keyCode==13) { $(this).closest('form').submit(); return false; }
          }).addClass('submitonenter');
          $dialog.find('select:visible:not(.submitondblclick)').dblclick(function(e) {
            $(this).closest('form').submit(); return false;
          }).addClass('submitondblclick');
          $dialog.find('button').not(':last').addClass('ui-priority-secondary'); 
        }
      };
      $els.addDialog.dialog($.extend({}, dialogOptions, { buttons: { 'Cancel': closeDialog, 'Add Feed': okAddDialog } }));
      $els.removeDialog.dialog($.extend({}, dialogOptions, { buttons: { 'Cancel': closeDialog, 'Remove Feed': okRemoveDialog } }));
    }
    function refreshSideBar() {
      $els.sources.children('.source').remove();
      forEachFeed(function(feed) {
        var $div = $('<div class="source"><img class="icon"/><h1></h1></div>').attr('id', 'feed-'+feed.id);
        $div.children('h1').text(feed.label);
        $div.children('.icon').attr('src', feed.icon);
        $div.data('feedId', feed.id);
        $els.sources.append($div);
      });
    };
    function sectionChange(event, ui) {
      $els.sources.find('.source').removeClass('active');
      $('#feed-' + ui.sectionId).addClass('active');
    };
    function createRow(item) {
      var $row;
      if (item.type=='feed_header') {
        $row = $('<div class="header"><img class="icon"/><h1></h1></div>');
        $row.children('h1').text(item.title);
        item.icon && $row.children('.icon').attr('src', item.icon);
      } else {
        $row = $('<div class="item"><a><h2></h2><div class="preview"></div></a></div>');
        $row.children('a').attr('href', item.link).data('feed_item', item);
        item.clicked && $row.children('a').addClass('clicked');
        if (self.showingItem && item.id === self.showingItem) { 
          $row.children('a').addClass('active'); 
        }
        $row.find('h2').text(item.title);
        fixRowPreview($row, item);
      }
      return $row;
    };
    function fixRowPreview($row, item) {
      var previewHeight = item.height - o.heights.item_title,
        $preview = $row.find('.preview');
      $row.height(item.height);
      if (previewHeight > 0) {
        $preview.text(item.description.substr(0, 300)).height(previewHeight);
        if (item.multisource) {
          $('<span class="domain"></span>').html('&hellip; ' + item.domain + '').appendTo($preview);
        }
      } else { $preview.hide(); }
    }
    function compareRows(row1, row2) {
      if (row1.seq < row2.seq) { return -1; }
      if (row1.seq == row2.seq) {
        if (row1.type == 'feed_header') {
          if (row2.type == 'feed_header') { return 0; }
          return -1;
        }
        if (row1.updated > row2.updated) { return -1; }
        if (row1.updated == row2.updated) {
          if (row1.link < row2.link) { return -1; }
          if (row1.link == row2.link) { return 0; }
        }
      }
      return 1;
    };
    function findRow(row) {
      var target;
      $.each(self.items, function(index, item) {
        target = index;
        if (compareRows(item, row) >= 0) { return false; }
      })
      return target;
    };
    function refreshRows(rows, first, last) {
      if (first === undefined || last === undefined) {
        Array.prototype.splice.apply(rows, [0, rows.length].concat(self.items));
        return 0;
      } else {
        var firstTo = findRow(rows[first]);
        var lastTo = findRow(rows[last]);

        if (first <= last) {
          Array.prototype.splice.apply(rows, [last, rows.length - last].concat(self.items.slice(lastTo)));
          Array.prototype.splice.apply(rows, [0, first].concat(self.items.slice(0, firstTo)));
          return firstTo - first;
        } else {
          // first > last: looking over border
          var slice = self.items.slice(lastTo, firstTo);
          Array.prototype.splice.apply(rows, [last, first - last].concat(slice));
          return slice.length - (first - last);
        }
      }
    };
    function createTitle(item) {
      var $a = $('<a class="title"></a>'),
        updated = new Date(item.updated * 1000),
        hours = updated.getHours(),
        amorpm = updated.getHours >= 12 ? ' PM' : ' AM',
        hours12 = !(hours % 12) ? 12 : hours % 12,
        minutes = updated.getMinutes() + '',
        minutesPad = minutes.length < 2 ? '0' + minutes : minutes,
        dateString = updated.toLocaleDateString() + ' ' + hours12 + ':' + minutesPad + amorpm;
      $a.attr('href', item.link);
      $('<div class="updated"></div>').text(dateString).appendTo($a);
      $('<h1></h1>').text(item.title).appendTo($a);
      item.author && $('<div class="author"></div>').text(item.author).appendTo($a);
      return $a;
    };
    function wasLeftClick(event) {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) { return false; }
      return !event.button;
    }
    function clickItem($a) {
      var item = $a.data('feed_item'),
        initialHeight = item.height;
      recordClick(item, function(result) {
        $els.infiniscroll.find('.active').removeClass('active');
        $a.addClass('clicked').addClass('active');
        self.showingItem = item.id;
        $els.contentFrame.empty().scrollTop(0);
        var $div = $('<div class="article"></div>');
        var $content = $('<div class="content"></div>').html(item.full_text.text).appendTo($div);
        $content.find('img').load(function() {
          var $that = $(this);
          setTimeout(function() {
            if ($that.width() > o.wrapImageWidth) { $that.wrap('<span class="chillax-wrap-image"/>'); }
          });
        });
        $div.prepend(createTitle(item)).appendTo($els.contentFrame);
        addSocialTabs(item);
        if (o.collapseClicked) {
          //fixRowPreview($a.parent(), item);
          //$els.infiniscroll.infiniscroll('repositionAfter', $a.parent(), item.height - initialHeight);
        }
      });
    };
    function addSocialTabs(item) {
      var numTabs = $els.socialFrame.tabs('length');
      for (var i = 0; i < numTabs; i++) { $els.socialFrame.tabs('remove', 0); }
      
      // First do Hacker News...
      $.getJSON(o.hnCommentsAPI + encodeURIComponent(item.link) + "&callback=?", function(data) {
        if (item.id != self.showingItem) { return; } // too late, another item has been clicked
        self.addingTabs = true;
        $.each(data, function(index, val) {
          $els.socialFrame.tabs('option', 'tabTemplate', '<li class="loading"><a href="#{href}"><span class="hn-icon"></span><span>#{label}</span></a></li>');
          $els.socialFrame.tabs('add', '#hn-'+val, 'news.yc');
          $els.socialFrame.tabs('select', -1);
          var $iframe = $('<iframe frameborder="0"/>');
          $iframe.get(0).onload = function() {
            $('a[href=#hn-'+val+']').parent().removeClass('loading');
          };
          $iframe.attr('src', o.hnCommentsURL + val).appendTo('#hn-'+val);
          // Update label with post age and comment count
          $.getJSON(o.hnPostAPI + val + '?format=jsonp&callback=?', function(data) {
            newLabel = data.postedAgo.replace(/^(\d+)\s(\w)\w*/, '$1$2') + ' (' + data.commentCount + ')';
            $('a[href=#hn-'+val+']>span:not(.hn-icon)').text(newLabel);
          });
        });
        self.addingTabs = false;
      });
      
      // Then Reddit.
      $.getJSON(o.redditCommentsAPI + encodeURIComponent(item.link) + "&jsonp=?", function(data) {
        if (item.id != self.showingItem) { return; } // too late, another item has been clicked
        self.addingTabs = true;
        if (data.data.children.length > 3) {
          data.data.children = data.data.children.sort(function(a, b) {
            return b.data.num_comments - a.data.num_comments;
          }).slice(0, 3);
        }
        $.each(data.data.children, function(index, val) {
          var id = val.data.id, label;
          label = val.data.permalink.match(/^\/([^\/]+\/[^\/]+)/)[1] + ' (' + val.data.num_comments + ')';
          $els.socialFrame.tabs('option', 'tabTemplate', '<li class="loading"><a href="#{href}"><span class="reddit-icon"></span><span>#{label}</span></a></li>');
          $els.socialFrame.tabs('add', '#reddit-'+id, label);
          $els.socialFrame.tabs('select', -1);
          var $iframe = $('<iframe frameborder="0"/>');
          $iframe.get(0).onload = function() {
            $('a[href=#reddit-'+id+']').parent().removeClass('loading');
          };
          $iframe.attr('src', o.redditCommentsURL + val.data.permalink).appendTo('#reddit-'+id);
        });
        self.addingTabs = false;
      });
    };
    function showSocialTab(event, ui) { 
      if (!self.addingTabs && !$els.socialFrame.hasClass('open')) {
        self.socialHeight = Math.min($(window).height() * 0.8, Math.max($(window).height() * 0.6, 300));
        $els.socialFrame.stop().height(self.socialHeight).css('bottom', -self.socialHeight - 1);
        $els.socialFrame.animate({bottom: 0}, 200, 'swing', function() {
          $els.socialFrame.addClass('open');
          $(ui.panel).children('iframe').hide().show();
          $els.contentFrame.css('bottom', self.socialHeight);
        });
      }
      if (!self.addingTabs) {
        $(ui.tab).parent().removeClass('loading');
      }
    };
    function selectSocialTab(event, ui) {
      if ($(ui.tab).parent().is('.ui-tabs-selected')) {
        $els.socialFrame.removeClass('open');
        $els.contentFrame.css('bottom', 0);
        $els.socialFrame.stop().animate({bottom: (-self.socialHeight - 1)}, 200, 'swing');
      }
    };
    
    /**
     * Private functions for the dialogs
     **/
    function openAddDialog() {
      $els.addDialog.find('.dialog-error').hide();
      $els.addDialog.dialog('open');
    }
    function okAddDialog() {
      var $this = $(this),
        $label = $this.find('input[name=label]'),
        $url = $this.find('input[name=url]'),
        $homepage = $this.find('input[name=homepage]'),
        $error = $this.find('.dialog-error'),
        error = '';
      $url.val($.trim($url.val()));
      $homepage.val($.trim($homepage.val()));
      if (!$homepage.val().match(/^(http|https|feed):\/\//i)) {
        $homepage.val('http://' + $homepage.val());
      }
      if (!$label.val().length) {
        $label.focus();
        error = 'Please enter a label.';
      }
      if (!$url.val().length || !$url.val().match(/^(http|https|feed):\/\//i)) {
        $url.select();
        error = 'Please enter a valid feed URL.';
      }
      if (error) {
        $error.show('pulsate', {times: 1}, 300).find('.message').text(error);
      } else {
        addFeed({
          link: $url.val(),
          homepage: $homepage.val(),
          label: $label.val(),
          use_viewtext: $this.find('select[name=use_viewtext]').val()
        }, function(result) {
          var id = result.insertId;
          $this.dialog('close');
          refreshSideBar();
          $('#feed-'+id).addClass('ui-state-disabled');
          withFeed(id, function(feed) { 
            pullNewItems(feed, function() {
              fetchItems(true);
              $('#feed-'+id).removeClass('ui-state-disabled');
            });
          });
        });
      }
    }
    function closeDialog() {
      $(this).dialog('close');
    }
    function openRemoveDialog() {
      var $sel = $els.removeDialog.find('select[name=feed_id]').empty();
      forEachFeed(function(feed) {
        $('<option></option>').text(feed.label).attr('value', feed.id).appendTo($sel);
      }, 0, function() {
        var $active = $els.sources.find('.source.active');
        if ($active.length) { $sel.val($active.data('feedId')); }
        if ($sel.children().length <= 1) { alert('Sorry, you have to have at least one feed.'); return; }
        $els.removeDialog.dialog('open');
      });
    }
    function okRemoveDialog() {
      var $this = $(this),
        feedId = $els.removeDialog.find('select[name=feed_id]').val();
      removeFeed(feedId, function(result) {
        refreshSideBar();
        fetchItems(true);
        $this.dialog('close');
      });
    }
    
    /**
     * Private functions that keep time, e.g. timing between refreshing all feeds
     **/
    function setRefreshTimer() {
      self.fetchAllTimeout = setTimeout(refreshAllFeeds, o.refreshInterval);
    }
    function refreshAllFeeds(dontSetTimer) {
      clearTimeout(self.fetchAllTimeout);
      fetchAllFeeds(false, 5 * 1000);
      if (dontSetTimer !== true) { setRefreshTimer(); }
    }
    
    /**
     * The Initialization function:
     * configures all of Chillax's internal widgets, binds initial events
     **/
    function init() {
      var clear = window.location.hash.match('clear');
      initializeDatastore(clear, function() {
        window.location.hash = '';
        refreshSideBar();
        fetchItems(true);
        if (navigator.onLine !== false) {
          fetchAllFeeds(true);
        }
        setRefreshTimer();
        initUI();
      }, function() {
        alert('You must use either Chrome, Safari, or Opera and enable Web Database storage to view this site.');
        return false;
      });
    };
    
    // export some functions for debugging purposes
    self.fetchItems = fetchItems;
    self.fetchAllFeeds = fetchAllFeeds;
    
    init();
  }
  
  $.chillax = new ChillaxReader({});

})(jQuery);