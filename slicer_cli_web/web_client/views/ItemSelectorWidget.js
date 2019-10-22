import _ from 'underscore';

import { getCurrentUser } from '@girder/core/auth';
import HierarchyWidget from '@girder/core/views/widgets/HierarchyWidget';
import RootSelectorWidget from '@girder/core/views/widgets/RootSelectorWidget';
import View from '@girder/core/views/View';
import ItemModel from '@girder/core/models/ItemModel';
import FileModel from '@girder/core/models/FileModel';
import { restRequest } from '@girder/core/rest';

import itemSelectorWidget from '../templates/itemSelectorWidget.pug';

var ItemSelectorWidget = View.extend({
    events: {
        'submit .s-new-file-select-form': '_selectButton'
    },

    initialize: function (settings) {
        if (!this.model) {
            this.model = new ItemModel();
        }
        this.rootPath = settings.rootPath || getCurrentUser();
        if (settings.rootPath === false) {
            // explictly set to choose a root
            this.rootPath = null;
        }

        if (!this.rootPath) {
            // generate the root selection view and listen to it's events
            this._rootSelectionView = new RootSelectorWidget(_.extend({
                parentView: this
            }, settings.rootSelectorSettings));
            this.listenTo(this._rootSelectionView, 'g:selected', function (evt) {
                this.rootPath = evt.root;
                this._renderHierarchyView();
            });
        }
    },

    render: function () {
        this.$el.html(
            itemSelectorWidget(this.model.toJSON())
        ).girderModal(this);
        this._renderRootSelection();
        return this;
    },

    _renderHierarchyView: function () {
        if (this._hierarchyView) {
            this.stopListening(this._hierarchyView);
            this._hierarchyView.off();
            this.$('.s-hierarchy-widget-container').empty();
        }
        if (!this.rootPath) {
            return;
        }
        this.$('.g-wait-for-root').removeClass('hidden');
        this._hierarchyView = new HierarchyWidget({
            parentView: this,
            parentModel: this.rootPath,
            checkboxes: false,
            routing: false,
            showActions: false,
            showMetadata: false,
            downloadLinks: false,
            viewLinks: false,
            onItemClick: _.bind(this._selectItem, this)
        });
        this._hierarchyView.setElement(this.$('.s-hierarchy-widget-container')).render();
    },

    _renderRootSelection: function () {
        if (this._rootSelectionView) {
            this._rootSelectionView.setElement(this.$('.s-hierarchy-root-container')).render();
        }
        this._renderHierarchyView();
    },

    /**
     * Get the currently displayed path in the hierarchy view.
     */
    _path: function () {
        var path = this._hierarchyView.breadcrumbs.map(function (d) {
            return d.get('name');
        });

        if (this.model.get('type') === 'directory') {
            path = _.initial(path);
        }
        return path;
    },

    _selectItem: function (item) {
        var image, file;

        switch (this.model.get('type')) {
            case 'item':
                this.model.set({
                    path: this._path(),
                    value: item
                });
                this.trigger('g:saved');
                this.$el.modal('hide');
                break;
            case 'file':
                restRequest({url: '/item/' + item.id + '/files', data: {limit: 1}}).done((resp) => {
                    if (!resp.length) {
                        this.$('.s-modal-error').removeClass('hidden')
                            .text('Please select a item with at least one file.');
                        return;
                    }
                    file = new FileModel({_id: resp[0]._id});
                    file.once('g:fetched', _.bind(function () {
                        this.model.set({
                            path: this._path(),
                            value: file
                        });
                        this.trigger('g:saved');
                    }, this)).fetch();
                    this.$el.modal('hide');
                }).fail(() => {
                    this.$('.s-modal-error').removeClass('hidden')
                        .text('There was an error listing files for the selected item.');
                });
                break;
            case 'image':
                image = item.get('largeImage');

                if (!image) {
                    this.$('.s-modal-error').removeClass('hidden')
                        .text('Please select a "large_image" item.');
                    return;
                }

                // Prefer the large_image fileId
                file = new FileModel({_id: image.fileId || image.originalId});
                file.once('g:fetched', _.bind(function () {
                    this.model.set({
                        path: this._path(),
                        value: file
                    });
                    this.trigger('g:saved');
                }, this)).fetch();
                this.$el.modal('hide');
                break;
        }
    },

    _selectButton: function (e) {
        e.preventDefault();

        var inputEl = this.$('#s-new-file-name');
        var inputElGroup =  inputEl.parent();
        var fileName = inputEl.val();
        var type = this.model.get('type');
        var parent = this._hierarchyView.parentModel;
        var errorEl = this.$('.s-modal-error').addClass('hidden');

        inputElGroup.removeClass('has-error');

        switch (type) {
            case 'new-file':

                // a file name must be provided
                if (!fileName) {
                    inputElGroup.addClass('has-error');
                    errorEl.removeClass('hidden')
                        .text('You must provide a name for the new file.');
                    return;
                }

                // the parent must be a folder
                if (parent.resourceName !== 'folder') {
                    errorEl.removeClass('hidden')
                        .text('Files cannot be added under collections.');
                    return;
                }

                this.model.set({
                    path: this._path(),
                    parent: parent,
                    value: new ItemModel({
                        name: fileName,
                        folderId: parent.id
                    })
                });
                break;

            case 'directory':
                this.model.set({
                    path: this._path(),
                    value: parent
                });
                break;
        }
        this.trigger('g:saved');
        this.$el.modal('hide');
    }
});

export default ItemSelectorWidget;
